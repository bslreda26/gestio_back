import type Produit from '#models/produit'
import type DepotStock from '#models/depot_stock'
import { getStockStatus } from '#helpers/produit_query'
import { resolveStockDisplay } from '#services/vente_unite_service'

export type SerializedDepotStock = {
  depot_id: number
  depot_code: string
  depot_nom: string
  is_default: boolean
  quantite: number
  stock_label: string
  stock_status: ReturnType<typeof getStockStatus>
}

export function serializeDepotStockRow(
  row: DepotStock & { depot: { id: number; code: string; nom: string; isDefault: boolean } },
  produit: Produit
): SerializedDepotStock {
  const quantite = Number(row.quantite)
  const stockDisplay = resolveStockDisplay(produit, quantite)

  return {
    depot_id: row.depot.id,
    depot_code: row.depot.code,
    depot_nom: row.depot.nom,
    is_default: row.depot.isDefault,
    quantite,
    stock_label: stockDisplay.stockLabel,
    stock_status: getStockStatus(
      quantite,
      Number(produit.stockMinimum),
      Number(produit.stockMaximum)
    ),
  }
}

export function aggregateStockStatus(
  stocksParDepot: SerializedDepotStock[],
  stockMinimum: number,
  stockMaximum: number,
  stockTotal: number
) {
  const depotStatuses = stocksParDepot.map((s) => s.stock_status)
  if (depotStatuses.includes('rupture') || stockTotal <= 0) return 'rupture' as const
  if (depotStatuses.includes('alerte') || stockTotal <= stockMinimum) return 'alerte' as const
  if (stockMaximum > 0 && (depotStatuses.includes('surstock') || stockTotal >= stockMaximum)) {
    return 'surstock' as const
  }
  return 'normal' as const
}
