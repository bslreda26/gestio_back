import Produit from '#models/produit'
import TvaGroupe from '#models/tva_groupe'
import { pickNumber, pickString, validateRequiredFields } from '#helpers/excel_import'
import type { ImportRequiredField } from '#helpers/excel_import'
import {
  calcProduitPricingFromVenteTtc,
  derivePrixAchatHtFromPlancher,
} from '#services/pricing_service'
import { toProduitPrixStockage } from '#services/vente_unite_service'
import type { ImportSummary } from '#types/import_result'
import { emptyImportSummary } from '#types/import_result'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

const FIELD_ALIASES = {
  code: ['code', 'ref', 'reference', 'code_produit', 'article'],
  nom: ['nom', 'designation', 'libelle', 'name', 'produit', 'description_produit'],
  plancher: ['plancher', 'prix_plancher', 'prix_min'],
  prix_vente_ttc: ['prix_vente_ttc', 'prix_ttc', 'prix_vente', 'pv_ttc'],
  prix_achat_ht: ['prix_achat_ht', 'pa_ht', 'prix_achat', 'cout_ht'],
  frais: ['frais', 'frais_ttc', 'frais_unitaire', 'cout_frais'],
  stock_minimum: ['stock_minimum', 'seuil_min', 'stock_min', 'alerte_min'],
  stock_maximum: ['stock_maximum', 'seuil_max', 'stock_max', 'alerte_max'],
  tva_groupe_id: ['tva_groupe_id', 'id_tva', 'tva_id'],
  tva_code: ['tva_code', 'code_tva', 'groupe_tva'],
  tva_taux: ['tva', 'taux_tva', 'tva_pct', 'tva_taux', 'taux_tva_pct'],
  airsi_pct: ['airsi', 'airsi_pct', 'taux_airsi', 'pct_airsi'],
} as const

type ArticleImportOptions = {
  pointDeVenteId: number
  defaultTvaGroupeId: number
  updateExisting: boolean
}

type TvaCache = {
  byId: Map<number, TvaGroupe>
  byCode: Map<string, TvaGroupe>
  byTaux: Map<number, TvaGroupe>
}

const REQUIRED_ARTICLE_FIELDS: ImportRequiredField[] = [
  { field: 'code', aliases: [...FIELD_ALIASES.code], message: 'Code obligatoire' },
  {
    field: 'designation',
    aliases: [...FIELD_ALIASES.nom],
    message: 'Désignation obligatoire',
  },
]

function hasTvaInRow(row: Record<string, unknown>): boolean {
  return (
    pickNumber(row, [...FIELD_ALIASES.tva_groupe_id]) !== undefined ||
    pickString(row, [...FIELD_ALIASES.tva_code]) !== undefined ||
    pickNumber(row, [...FIELD_ALIASES.tva_taux]) !== undefined
  )
}

function validateArticleRow(row: Record<string, unknown>, rowNumber: number) {
  const errors = validateRequiredFields(row, rowNumber, REQUIRED_ARTICLE_FIELDS)

  if (!hasTvaInRow(row)) {
    errors.push({ row: rowNumber, field: 'tva', message: 'TVA obligatoire' })
  }

  return errors
}

function hasAirsiInRow(row: Record<string, unknown>): boolean {
  return pickNumber(row, [...FIELD_ALIASES.airsi_pct]) !== undefined
}

async function loadTvaCache(): Promise<TvaCache> {
  const groupes = await TvaGroupe.query().where('is_active', true)
  const byId = new Map<number, TvaGroupe>()
  const byCode = new Map<string, TvaGroupe>()
  const byTaux = new Map<number, TvaGroupe>()

  for (const groupe of groupes) {
    byId.set(groupe.id, groupe)
    byCode.set(groupe.code.trim().toUpperCase(), groupe)
    byTaux.set(Number(groupe.taux), groupe)
  }

  return { byId, byCode, byTaux }
}

function resolveTvaGroupeForRow(
  row: Record<string, unknown>,
  cache: TvaCache,
  defaultTvaGroupeId: number
): number {
  const idFromRow = pickNumber(row, [...FIELD_ALIASES.tva_groupe_id])
  if (idFromRow !== undefined) {
    const groupe = cache.byId.get(idFromRow)
    if (!groupe) {
      throw new Error(`Groupe TVA introuvable : id ${idFromRow}`)
    }
    return groupe.id
  }

  const codeFromRow = pickString(row, [...FIELD_ALIASES.tva_code])
  if (codeFromRow) {
    const groupe = cache.byCode.get(codeFromRow.trim().toUpperCase())
    if (!groupe) {
      throw new Error(`Groupe TVA introuvable : code ${codeFromRow}`)
    }
    return groupe.id
  }

  const tauxFromRow = pickNumber(row, [...FIELD_ALIASES.tva_taux])
  if (tauxFromRow !== undefined) {
    const groupe = cache.byTaux.get(tauxFromRow)
    if (!groupe) {
      throw new Error(`Groupe TVA introuvable pour le taux ${tauxFromRow}%`)
    }
    return groupe.id
  }

  return defaultTvaGroupeId
}

function resolveAirsiPctFromRow(row: Record<string, unknown>): number {
  const airsi = pickNumber(row, [...FIELD_ALIASES.airsi_pct]) ?? 0
  if (airsi < 0 || airsi > 100) {
    throw new Error('AIRSI invalide — doit être entre 0 et 100')
  }
  return airsi
}

async function resolveDefaultTvaGroupeId(explicitId?: number): Promise<number> {
  if (explicitId) {
    const groupe = await TvaGroupe.find(explicitId)
    if (!groupe || !groupe.isActive) {
      throw new Error('Groupe TVA introuvable ou inactif')
    }
    return groupe.id
  }

  const groupe = await TvaGroupe.query().where('code', 'TVA18').where('is_active', true).first()
  if (groupe) return groupe.id

  const fallback = await TvaGroupe.query().where('is_active', true).orderBy('id', 'asc').first()
  if (!fallback) {
    throw new Error("Aucun groupe TVA actif — configurez la TVA avant l'import articles")
  }
  return fallback.id
}

function hasFraisInRow(row: Record<string, unknown>): boolean {
  return pickNumber(row, [...FIELD_ALIASES.frais]) !== undefined
}

function resolveFraisForImport(row: Record<string, unknown>, existingFrais = 0): number {
  const frais = pickNumber(row, [...FIELD_ALIASES.frais])
  if (frais !== undefined) {
    if (frais < 0) {
      throw new Error('Frais invalide — doit être positif ou nul')
    }
    return frais
  }
  return existingFrais
}

/** Frais TTC pris en compte dans le dérivé plancher → prix achat (colonne Excel uniquement). */
function resolveFraisForDerivation(row: Record<string, unknown>): number {
  if (!hasFraisInRow(row)) {
    return 0
  }
  return resolveFraisForImport(row)
}

function resolvePrixAchatHtForImport(
  row: Record<string, unknown>,
  tvaGroupe: TvaGroupe,
  options: {
    fraisForDerivation: number
    existingPrixAchatHt?: number
    existingPlancher?: number
    deriveFromExistingPlancher?: boolean
  }
): number {
  const prixAchatFromFile = pickNumber(row, [...FIELD_ALIASES.prix_achat_ht])
  if (prixAchatFromFile !== undefined) {
    return prixAchatFromFile
  }

  const plancherFromFile = pickNumber(row, [...FIELD_ALIASES.plancher])
  const plancherForDerivation =
    plancherFromFile ??
    (options.deriveFromExistingPlancher ? options.existingPlancher : undefined)

  if (plancherForDerivation !== undefined) {
    return derivePrixAchatHtFromPlancher(
      plancherForDerivation,
      options.fraisForDerivation,
      Number(tvaGroupe.taux)
    )
  }

  return options.existingPrixAchatHt ?? 0
}

function buildPricingForRow(
  row: Record<string, unknown>,
  tvaGroupe: TvaGroupe,
  existing?: Produit,
  options?: { deriveFromExistingPlancher?: boolean }
) {
  const frais = resolveFraisForImport(row, Number(existing?.frais ?? 0))
  const fraisForDerivation = resolveFraisForDerivation(row)
  const prixAchatHt = resolvePrixAchatHtForImport(row, tvaGroupe, {
    fraisForDerivation,
    existingPrixAchatHt: existing ? Number(existing.prixAchatHt) : undefined,
    existingPlancher: existing ? Number(existing.plancher) : undefined,
    deriveFromExistingPlancher: options?.deriveFromExistingPlancher,
  })
  const prixVenteTtc =
    pickNumber(row, [...FIELD_ALIASES.prix_vente_ttc]) ?? Number(existing?.prixVenteTtc ?? 0)

  const prixStockage = toProduitPrixStockage(prixAchatHt, frais, {
    unite: existing?.unite ?? 'pièce',
    uniteGros: existing?.uniteGros ?? null,
    contenance: String(existing?.contenance ?? 1),
  })

  return calcProduitPricingFromVenteTtc({
    prixAchatHt: prixStockage.prixAchatHt,
    prixVenteTtc,
    frais: prixStockage.frais,
    tauxTva: Number(tvaGroupe.taux),
  })
}

async function applyProduitUpdatesFromRow(
  produit: Produit,
  row: Record<string, unknown>,
  cache: TvaCache,
  defaultTvaGroupeId: number,
  trx: TransactionClientContract
) {
  const nom = pickString(row, [...FIELD_ALIASES.nom])
  const plancher = pickNumber(row, [...FIELD_ALIASES.plancher])
  const stockMinimum = pickNumber(row, [...FIELD_ALIASES.stock_minimum])
  const stockMaximum = pickNumber(row, [...FIELD_ALIASES.stock_maximum])
  const prixAchatFromFile = pickNumber(row, [...FIELD_ALIASES.prix_achat_ht])
  const fraisFromFile = pickNumber(row, [...FIELD_ALIASES.frais])
  const prixVenteTtc = pickNumber(row, [...FIELD_ALIASES.prix_vente_ttc])
  const plancherSetsPrixAchat =
    prixAchatFromFile === undefined &&
    (plancher !== undefined ||
      (fraisFromFile !== undefined && Number(produit.plancher) > 0))

  const tvaChanged = hasTvaInRow(row)
  const tvaGroupeId = tvaChanged
    ? resolveTvaGroupeForRow(row, cache, defaultTvaGroupeId)
    : produit.tvaGroupeId

  const tvaGroupe = cache.byId.get(tvaGroupeId) ?? (await TvaGroupe.findOrFail(tvaGroupeId))

  const merge: Partial<Produit> = {
    nom: nom ?? produit.nom,
    plancher: String(plancher ?? produit.plancher),
    stockMinimum: String(stockMinimum ?? produit.stockMinimum),
    stockMaximum: String(stockMaximum ?? produit.stockMaximum),
  }

  if (tvaChanged) {
    merge.tvaGroupeId = tvaGroupeId
  }

  if (hasAirsiInRow(row)) {
    merge.airsiPct = String(resolveAirsiPctFromRow(row))
  }

  if (
    tvaChanged ||
    prixAchatFromFile !== undefined ||
    plancherSetsPrixAchat ||
    prixVenteTtc !== undefined ||
    fraisFromFile !== undefined
  ) {
    const resolvedFrais = resolveFraisForImport(row, Number(produit.frais))
    const fraisForDerivation = resolveFraisForDerivation(row)
    const deriveFromExistingPlancher =
      plancher === undefined &&
      fraisFromFile !== undefined &&
      prixAchatFromFile === undefined &&
      Number(produit.plancher) > 0
    const resolvedPrixAchatHt = resolvePrixAchatHtForImport(row, tvaGroupe, {
      fraisForDerivation,
      existingPrixAchatHt: Number(produit.prixAchatHt),
      existingPlancher: Number(produit.plancher),
      deriveFromExistingPlancher,
    })
    const pricing = buildPricingForRow(row, tvaGroupe, produit, { deriveFromExistingPlancher })
    const prixStockage = toProduitPrixStockage(resolvedPrixAchatHt, resolvedFrais, {
      unite: produit.unite,
      uniteGros: produit.uniteGros,
      contenance: produit.contenance,
    })

    merge.prixAchatHt = String(prixStockage.prixAchatHt)
    merge.prixAchatTtc = String(pricing.prixAchatTtc)
    merge.prixVenteHt = String(pricing.prixVenteHt)
    merge.prixVenteTtc = String(pricing.prixVenteTtc)
    if (fraisFromFile !== undefined) {
      merge.frais = String(prixStockage.frais)
    }

    if (prixAchatFromFile !== undefined || plancherSetsPrixAchat) {
      merge.dernierPrixAchatHt = String(resolvedPrixAchatHt)
    }

    if (plancher === undefined && tvaChanged) {
      merge.plancher = String(pricing.plancher)
    }
  }

  produit.merge(merge)
  produit.useTransaction(trx)
  await produit.save()
}

async function createProduitFromRow(
  row: Record<string, unknown>,
  options: ArticleImportOptions,
  cache: TvaCache,
  trx: TransactionClientContract
): Promise<Produit> {
  const code = pickString(row, [...FIELD_ALIASES.code])!
  const nom = pickString(row, [...FIELD_ALIASES.nom])!

  const tvaGroupeId = resolveTvaGroupeForRow(row, cache, options.defaultTvaGroupeId)
  const tvaGroupe = cache.byId.get(tvaGroupeId) ?? (await TvaGroupe.findOrFail(tvaGroupeId))
  const airsiPct = resolveAirsiPctFromRow(row)
  const frais = resolveFraisForImport(row)
  const fraisForDerivation = resolveFraisForDerivation(row)
  const prixAchatHt = resolvePrixAchatHtForImport(row, tvaGroupe, { fraisForDerivation })
  const prixVenteTtc = pickNumber(row, [...FIELD_ALIASES.prix_vente_ttc]) ?? 0
  const prixStockage = toProduitPrixStockage(prixAchatHt, frais, {
    unite: 'pièce',
    uniteGros: null,
    contenance: '1',
  })
  const pricing = calcProduitPricingFromVenteTtc({
    prixAchatHt: prixStockage.prixAchatHt,
    prixVenteTtc,
    frais: prixStockage.frais,
    tauxTva: Number(tvaGroupe.taux),
  })

  const plancherFromFile = pickNumber(row, [...FIELD_ALIASES.plancher])

  return Produit.create(
    {
      code,
      pointDeVenteId: options.pointDeVenteId,
      nom,
      description: null,
      categorieId: null,
      tvaGroupeId,
      prixAchatHt: String(prixStockage.prixAchatHt),
      prixAchatTtc: String(pricing.prixAchatTtc),
      dernierPrixAchatHt: String(prixAchatHt),
      prixVenteHt: String(pricing.prixVenteHt),
      prixVenteTtc: String(pricing.prixVenteTtc),
      frais: String(prixStockage.frais),
      plancher: String(plancherFromFile ?? pricing.plancher),
      unite: 'pièce',
      uniteGros: null,
      contenance: '1',
      venteAuDetail: false,
      venteSousPlancher: false,
      stockActuel: '0',
      stockMinimum: String(pickNumber(row, [...FIELD_ALIASES.stock_minimum]) ?? 0),
      stockMaximum: String(pickNumber(row, [...FIELD_ALIASES.stock_maximum]) ?? 0),
      isActive: true,
      airsiPct: String(airsiPct),
    },
    { client: trx }
  )
}

export async function importArticlesFromRows(
  rows: Record<string, unknown>[],
  options: Omit<ArticleImportOptions, 'defaultTvaGroupeId'> & { tvaGroupeId?: number }
): Promise<ImportSummary> {
  const summary = emptyImportSummary()
  summary.total_rows = rows.length

  const defaultTvaGroupeId = await resolveDefaultTvaGroupeId(options.tvaGroupeId)
  const tvaCache = await loadTvaCache()
  const importOptions: ArticleImportOptions = { ...options, defaultTvaGroupeId }

  for (let index = 0; index < rows.length; index++) {
    const rowNumber = index + 2
    const row = rows[index]

    const rowErrors = validateArticleRow(row, rowNumber)
    if (rowErrors.length > 0) {
      summary.errors.push(...rowErrors)
      summary.skipped++
      continue
    }

    const code = pickString(row, [...FIELD_ALIASES.code])!

    try {
      await db.transaction(async (trx) => {
        const existing = await Produit.query({ client: trx })
          .where('point_de_vente_id', importOptions.pointDeVenteId)
          .where('code', code)
          .first()

        if (existing) {
          if (!importOptions.updateExisting) {
            throw new Error(`Article déjà existant : ${code}`)
          }
          await applyProduitUpdatesFromRow(
            existing,
            row,
            tvaCache,
            defaultTvaGroupeId,
            trx
          )
          summary.updated++
          return
        }

        await createProduitFromRow(row, importOptions, tvaCache, trx)
        summary.created++
      })
    } catch (error) {
      summary.errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      })
      summary.skipped++
    }
  }

  return summary
}
