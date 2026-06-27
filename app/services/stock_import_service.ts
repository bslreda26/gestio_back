import Depot from '#models/depot'
import Produit from '#models/produit'
import TvaGroupe from '#models/tva_groupe'
import { pickNumber, pickString, validateRequiredFields } from '#helpers/excel_import'
import { calcProduitPricingFromVenteTtc } from '#services/pricing_service'
import { fixerStockDepot } from '#services/stock_service'
import { toProduitPrixStockage } from '#services/vente_unite_service'
import type { ImportSummary } from '#types/import_result'
import { emptyImportSummary } from '#types/import_result'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

const FIELD_ALIASES = {
  code: ['code', 'ref', 'reference', 'code_produit', 'article'],
  nom: ['nom', 'designation', 'libelle', 'name', 'produit', 'description_produit'],
  depot: ['depot', 'depot_code', 'code_depot', 'magasin', 'entrepot'],
  quantite: ['quantite', 'qte', 'quantity', 'stock', 'stock_actuel'],
  plancher: ['plancher', 'prix_plancher', 'prix_min'],
  prix_vente_ttc: ['prix_vente_ttc', 'prix_ttc', 'prix_vente', 'pv_ttc'],
  prix_achat_ht: ['prix_achat_ht', 'pa_ht', 'prix_achat', 'cout_ht'],
  stock_minimum: ['stock_minimum', 'seuil_min', 'stock_min', 'alerte_min'],
  stock_maximum: ['stock_maximum', 'seuil_max', 'stock_max', 'alerte_max'],
  tva_groupe_id: ['tva_groupe_id', 'id_tva', 'tva_id'],
  tva_code: ['tva_code', 'code_tva', 'groupe_tva'],
  tva_taux: ['tva', 'taux_tva', 'tva_pct', 'tva_taux', 'taux_tva_pct'],
  airsi_pct: ['airsi', 'airsi_pct', 'taux_airsi', 'pct_airsi'],
} as const

type StockImportOptions = {
  pointDeVenteId: number
  userId: number
  defaultTvaGroupeId: number
  updateExisting: boolean
  createMissingProducts: boolean
}

type TvaCache = {
  byId: Map<number, TvaGroupe>
  byCode: Map<string, TvaGroupe>
  byTaux: Map<number, TvaGroupe>
}

function hasTvaInRow(row: Record<string, unknown>): boolean {
  return (
    pickNumber(row, [...FIELD_ALIASES.tva_groupe_id]) !== undefined ||
    pickString(row, [...FIELD_ALIASES.tva_code]) !== undefined ||
    pickNumber(row, [...FIELD_ALIASES.tva_taux]) !== undefined ||
    pickString(row, ['tva']) !== undefined
  )
}

const REQUIRED_STOCK_FIELDS = [
  { field: 'code', aliases: [...FIELD_ALIASES.code], message: 'Code obligatoire' },
  {
    field: 'designation',
    aliases: [...FIELD_ALIASES.nom],
    message: 'Désignation obligatoire',
  },
  { field: 'quantite', aliases: [...FIELD_ALIASES.quantite], message: 'Quantité obligatoire' },
  { field: 'depot', aliases: [...FIELD_ALIASES.depot], message: 'Dépôt obligatoire' },
] as const

function validateStockRow(row: Record<string, unknown>, rowNumber: number) {
  const errors = validateRequiredFields(row, rowNumber, [...REQUIRED_STOCK_FIELDS])

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

  const tvaCell = pickString(row, ['tva'])
  if (tvaCell) {
    const normalized = tvaCell.trim().toUpperCase()
    const byCode =
      cache.byCode.get(normalized) ??
      cache.byCode.get(normalized.startsWith('TVA') ? normalized : `TVA${normalized.replace('%', '')}`)
    if (byCode) return byCode.id

    const asTaux = Number(normalized.replace('%', '').replace(',', '.'))
    if (Number.isFinite(asTaux)) {
      const byTaux = cache.byTaux.get(asTaux)
      if (byTaux) return byTaux.id
      throw new Error(`Groupe TVA introuvable pour le taux ${asTaux}%`)
    }

    throw new Error(`Groupe TVA introuvable : ${tvaCell}`)
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

async function resolveDepot(pointDeVenteId: number, depotRef: string): Promise<Depot> {
  const depot = await Depot.query()
    .where('point_de_vente_id', pointDeVenteId)
    .where('is_active', true)
    .where((q) => {
      q.whereILike('code', depotRef).orWhereILike('nom', depotRef)
    })
    .first()

  if (!depot) {
    throw new Error(`Dépôt introuvable : ${depotRef}`)
  }

  return depot
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
    throw new Error("Aucun groupe TVA actif — configurez la TVA avant l'import stock")
  }
  return fallback.id
}

function buildPricingForRow(
  row: Record<string, unknown>,
  tvaGroupe: TvaGroupe,
  existing?: Produit
) {
  const prixAchatHt = pickNumber(row, [...FIELD_ALIASES.prix_achat_ht]) ?? Number(existing?.prixAchatHt ?? 0)
  const prixVenteTtc =
    pickNumber(row, [...FIELD_ALIASES.prix_vente_ttc]) ?? Number(existing?.prixVenteTtc ?? 0)
  const frais = Number(existing?.frais ?? 0)

  const prixStockage = toProduitPrixStockage(prixAchatHt, frais, {
    unite: existing?.unite ?? 'pièce',
    uniteGros: existing?.uniteGros ?? null,
    contenance: Number(existing?.contenance ?? 1),
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
  const prixAchatHt = pickNumber(row, [...FIELD_ALIASES.prix_achat_ht])
  const prixVenteTtc = pickNumber(row, [...FIELD_ALIASES.prix_vente_ttc])

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

  if (tvaChanged || prixAchatHt !== undefined || prixVenteTtc !== undefined) {
    const pricing = buildPricingForRow(row, tvaGroupe, produit)
    const prixStockage = toProduitPrixStockage(
      prixAchatHt ?? Number(produit.prixAchatHt),
      Number(produit.frais),
      {
        unite: produit.unite,
        uniteGros: produit.uniteGros,
        contenance: Number(produit.contenance),
      }
    )

    merge.prixAchatHt = String(prixStockage.prixAchatHt)
    merge.prixAchatTtc = String(pricing.prixAchatTtc)
    merge.prixVenteHt = String(pricing.prixVenteHt)
    merge.prixVenteTtc = String(pricing.prixVenteTtc)

    if (prixAchatHt !== undefined) {
      merge.dernierPrixAchatHt = String(prixAchatHt)
    }

    if (plancher === undefined && tvaChanged) {
      merge.plancher = String(pricing.plancher)
    }
  }

  produit.merge(merge)
  produit.useTransaction(trx)
  await produit.save()
}

async function findOrCreateProduit(
  row: Record<string, unknown>,
  options: StockImportOptions,
  cache: TvaCache
): Promise<{ produit: Produit; created: boolean }> {
  const code = pickString(row, [...FIELD_ALIASES.code])
  const nom = pickString(row, [...FIELD_ALIASES.nom])

  let produit: Produit | null = null

  if (code) {
    produit = await Produit.query()
      .where('point_de_vente_id', options.pointDeVenteId)
      .where('code', code)
      .first()
  }

  if (produit) {
    return { produit, created: false }
  }

  if (!options.createMissingProducts) {
    throw new Error(code ? `Produit introuvable : ${code}` : 'Produit introuvable (code manquant)')
  }

  if (!nom) {
    throw new Error('Désignation obligatoire pour créer un nouveau produit')
  }

  if (!code) {
    throw new Error('Code obligatoire')
  }

  const tvaGroupeId = resolveTvaGroupeForRow(row, cache, options.defaultTvaGroupeId)
  const tvaGroupe = cache.byId.get(tvaGroupeId) ?? (await TvaGroupe.findOrFail(tvaGroupeId))
  const airsiPct = resolveAirsiPctFromRow(row)
  const prixAchatHt = pickNumber(row, [...FIELD_ALIASES.prix_achat_ht]) ?? 0
  const prixVenteTtc = pickNumber(row, [...FIELD_ALIASES.prix_vente_ttc]) ?? 0
  const prixStockage = toProduitPrixStockage(prixAchatHt, 0, {
    unite: 'pièce',
    uniteGros: null,
    contenance: 1,
  })
  const pricing = calcProduitPricingFromVenteTtc({
    prixAchatHt: prixStockage.prixAchatHt,
    prixVenteTtc,
    frais: prixStockage.frais,
    tauxTva: Number(tvaGroupe.taux),
  })

  const plancherFromFile = pickNumber(row, [...FIELD_ALIASES.plancher])
  const productCode = code

  const duplicate = await Produit.query()
    .where('point_de_vente_id', options.pointDeVenteId)
    .where('code', code)
    .first()
  if (duplicate) {
    throw new Error(`Code produit déjà utilisé : ${code}`)
  }

  produit = await Produit.create({
    code: productCode,
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
  })

  return { produit, created: true }
}

export async function importStockFromRows(
  rows: Record<string, unknown>[],
  options: Omit<StockImportOptions, 'defaultTvaGroupeId'> & { tvaGroupeId?: number }
): Promise<ImportSummary> {
  const summary = emptyImportSummary()
  summary.total_rows = rows.length

  const defaultTvaGroupeId = await resolveDefaultTvaGroupeId(options.tvaGroupeId)
  const tvaCache = await loadTvaCache()
  const importOptions: StockImportOptions = { ...options, defaultTvaGroupeId }

  for (let index = 0; index < rows.length; index++) {
    const rowNumber = index + 2
    const row = rows[index]

    const rowErrors = validateStockRow(row, rowNumber)
    if (rowErrors.length > 0) {
      summary.errors.push(...rowErrors)
      summary.skipped++
      continue
    }

    const quantite = pickNumber(row, [...FIELD_ALIASES.quantite])!
    if (quantite < 0) {
      summary.errors.push({
        row: rowNumber,
        field: 'quantite',
        message: 'La quantité ne peut pas être négative',
      })
      summary.skipped++
      continue
    }

    try {
      await db.transaction(async (trx) => {
        const { produit, created } = await findOrCreateProduit(row, importOptions, tvaCache)

        if (!created && importOptions.updateExisting) {
          await applyProduitUpdatesFromRow(
            produit,
            row,
            tvaCache,
            defaultTvaGroupeId,
            trx
          )
        }

        const depotRef = pickString(row, [...FIELD_ALIASES.depot])!
        const depot = await resolveDepot(importOptions.pointDeVenteId, depotRef)

        await fixerStockDepot(
          produit.id,
          depot.id,
          quantite,
          importOptions.userId,
          'Import Excel',
          trx
        )

        if (created) {
          summary.created++
        } else {
          summary.updated++
        }
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
