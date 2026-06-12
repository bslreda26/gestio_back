import type Produit from '#models/produit'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

export type StockAlertFilter = 'rupture' | 'alerte' | 'normal' | 'surstock'

export function applyStockAlertFilter(
  query: ModelQueryBuilderContract<typeof Produit>,
  stockAlert: StockAlertFilter
) {
  switch (stockAlert) {
    case 'rupture':
      query.where('stock_actuel', '<=', 0)
      break
    case 'alerte':
      query.whereRaw('stock_actuel > 0 AND stock_actuel <= stock_minimum')
      break
    case 'normal':
      query.whereRaw('stock_actuel > stock_minimum AND stock_actuel < stock_maximum')
      break
    case 'surstock':
      query.whereRaw('stock_maximum > 0 AND stock_actuel >= stock_maximum')
      break
  }
}

export function getStockStatus(stockActuel: number, stockMinimum: number, stockMaximum: number) {
  if (stockActuel <= 0) return 'rupture'
  if (stockActuel <= stockMinimum) return 'alerte'
  if (stockMaximum > 0 && stockActuel >= stockMaximum) return 'surstock'
  return 'normal'
}
