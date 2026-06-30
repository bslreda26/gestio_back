import Depot from '#models/depot'
import Produit from '#models/produit'
import { pickNumber, pickString, validateRequiredFields } from '#helpers/excel_import'
import type { ImportRequiredField } from '#helpers/excel_import'
import {
  enregistrerSaisieInventaire,
  InventaireSaisieError,
  type InventaireSaisieLigneInput,
} from '#services/inventaire_saisie_service'
import { getStockDisponible } from '#services/stock_service'
import { canVenteAuDetail, hasUniteDetailConfig } from '#services/vente_unite_service'
import type { ImportSummary } from '#types/import_result'
import { emptyImportSummary } from '#types/import_result'

const FIELD_ALIASES = {
  code: ['code', 'ref', 'reference', 'code_produit', 'article'],
  quantite: [
    'quantite',
    'quantite_comptee',
    'qte',
    'stock',
    'quantite_stock',
    'qty',
  ],
  depot_code: ['depot_code', 'code_depot', 'depot'],
  depot_id: ['depot_id', 'id_depot'],
} as const

const REQUIRED_FIELDS: ImportRequiredField[] = [
  { field: 'code', aliases: [...FIELD_ALIASES.code], message: 'Code article obligatoire' },
  {
    field: 'quantite',
    aliases: [...FIELD_ALIASES.quantite],
    message: 'Quantité obligatoire',
  },
]

export type InventaireImportOptions = {
  pointDeVenteId: number
  depotId?: number
  userId: number
  notes?: string | null
}

export type InventaireImportResult = ImportSummary & {
  saisies: { depot_id: number; saisie_id: number; lignes: number }[]
}

type ParsedInventaireRow = {
  rowNumber: number
  code: string
  depotId: number
  quantiteCible: number
}

async function loadDepotMap(pointDeVenteId: number) {
  const depots = await Depot.query()
    .where('point_de_vente_id', pointDeVenteId)
    .where('is_active', true)

  const byId = new Map<number, Depot>()
  const byCode = new Map<string, Depot>()

  for (const depot of depots) {
    byId.set(depot.id, depot)
    byCode.set(depot.code.trim().toUpperCase(), depot)
  }

  return { byId, byCode }
}

function resolveDepotIdForRow(
  row: Record<string, unknown>,
  defaultDepotId: number | undefined,
  depotMap: { byId: Map<number, Depot>; byCode: Map<string, Depot> }
): number | undefined {
  const idFromRow = pickNumber(row, [...FIELD_ALIASES.depot_id])
  if (idFromRow !== undefined) {
    return depotMap.byId.get(idFromRow)?.id
  }

  const codeFromRow = pickString(row, [...FIELD_ALIASES.depot_code])
  if (codeFromRow) {
    return depotMap.byCode.get(codeFromRow.trim().toUpperCase())?.id
  }

  return defaultDepotId
}

function produitQuantiteEnUniteDetail(produit: Produit): boolean {
  return hasUniteDetailConfig(produit) || canVenteAuDetail(produit)
}

function buildLigneFromDelta(produit: Produit, delta: number): InventaireSaisieLigneInput {
  const ligne: InventaireSaisieLigneInput = {
    produit_id: produit.id,
    entree: delta > 0 ? delta : 0,
    sortie: delta < 0 ? Math.abs(delta) : 0,
  }

  if (produitQuantiteEnUniteDetail(produit)) {
    if (delta > 0) ligne.mode_vente_entree = 'detail'
    if (delta < 0) ligne.mode_vente_sortie = 'detail'
  }

  return ligne
}

export async function importInventaireFromRows(
  rows: Record<string, unknown>[],
  options: InventaireImportOptions
): Promise<InventaireImportResult> {
  const summary: InventaireImportResult = { ...emptyImportSummary(), saisies: [] }
  summary.total_rows = rows.length

  const depotMap = await loadDepotMap(options.pointDeVenteId)
  const parsedRows: ParsedInventaireRow[] = []

  for (let index = 0; index < rows.length; index++) {
    const rowNumber = index + 2
    const row = rows[index]

    const requiredErrors = validateRequiredFields(row, rowNumber, REQUIRED_FIELDS)
    if (requiredErrors.length > 0) {
      summary.errors.push(...requiredErrors)
      summary.skipped++
      continue
    }

    const depotId = resolveDepotIdForRow(row, options.depotId, depotMap)
    if (!depotId) {
      summary.errors.push({
        row: rowNumber,
        field: 'depot',
        message: options.depotId
          ? 'Dépôt introuvable ou inactif'
          : 'Dépôt obligatoire (colonne depot_code / depot_id ou paramètre depot_id)',
      })
      summary.skipped++
      continue
    }

    const quantiteCible = pickNumber(row, [...FIELD_ALIASES.quantite])!
    if (quantiteCible < 0) {
      summary.errors.push({
        row: rowNumber,
        field: 'quantite',
        message: 'La quantité doit être positive ou nulle',
      })
      summary.skipped++
      continue
    }

    parsedRows.push({
      rowNumber,
      code: pickString(row, [...FIELD_ALIASES.code])!,
      depotId,
      quantiteCible,
    })
  }

  if (parsedRows.length === 0) {
    return summary
  }

  const codes = [...new Set(parsedRows.map((r) => r.code))]
  const produits = await Produit.query()
    .where('point_de_vente_id', options.pointDeVenteId)
    .whereIn('code', codes)
    .where('is_active', true)

  const produitByCode = new Map(produits.map((p) => [p.code, p]))

  const lignesByDepot = new Map<number, { rowNumber: number; ligne: InventaireSaisieLigneInput }[]>()

  for (const parsed of parsedRows) {
    const produit = produitByCode.get(parsed.code)
    if (!produit) {
      summary.errors.push({
        row: parsed.rowNumber,
        field: 'code',
        message: `Article introuvable : ${parsed.code}`,
      })
      summary.skipped++
      continue
    }

    const { quantite: quantiteActuelle } = await getStockDisponible(produit.id, parsed.depotId)
    const delta = parsed.quantiteCible - quantiteActuelle

    if (delta === 0) {
      summary.skipped++
      continue
    }

    const ligne = buildLigneFromDelta(produit, delta)

    const bucket = lignesByDepot.get(parsed.depotId) ?? []
    bucket.push({ rowNumber: parsed.rowNumber, ligne })
    lignesByDepot.set(parsed.depotId, bucket)
  }

  const importNotes =
    options.notes?.trim() ||
    'Import Excel saisie inventaire'

  for (const [depotId, bucket] of lignesByDepot) {
    try {
      const { saisie, lignes } = await enregistrerSaisieInventaire(
        options.pointDeVenteId,
        depotId,
        bucket.map((b) => b.ligne),
        options.userId,
        importNotes
      )

      summary.created += lignes.length
      summary.saisies.push({
        depot_id: depotId,
        saisie_id: saisie.id,
        lignes: lignes.length,
      })
    } catch (error) {
      const message =
        error instanceof InventaireSaisieError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Erreur inconnue'

      for (const { rowNumber } of bucket) {
        summary.errors.push({ row: rowNumber, message })
        summary.skipped++
      }
    }
  }

  return summary
}
