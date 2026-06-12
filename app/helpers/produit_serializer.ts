import type Produit from '#models/produit'
import { getStockStatus } from '#helpers/produit_query'
import { getContenance, resolveStockDisplay } from '#services/vente_unite_service'

export function serializeProduit(
  produit: Produit,
  extras: Record<string, unknown> = {},
  options?: { hidePlancher?: boolean }
) {
  const json = produit.serialize()
  if (options?.hidePlancher) {
    delete json.plancher
  }
  const stockDetail = Number(json.stockActuel ?? produit.stockActuel)
  const contenance = getContenance(produit)
  const stockDisplay = resolveStockDisplay(produit, stockDetail)
  return {
    ...json,
    contenance,
    stockDetail: stockDisplay.stockDetail,
    stockPieces: stockDisplay.stockPieces,
    stockResteDetail: stockDisplay.stockResteDetail,
    stockLabel: stockDisplay.stockLabel,
    stockStatus: getStockStatus(
      stockDetail,
      Number(json.stockMinimum ?? produit.stockMinimum),
      Number(json.stockMaximum ?? produit.stockMaximum)
    ),
    ...extras,
  }
}
