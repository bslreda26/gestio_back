import { DepotStockSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Depot from '#models/depot'
import Produit from '#models/produit'

export default class DepotStock extends DepotStockSchema {
  @belongsTo(() => Depot, { foreignKey: 'depotId' })
  declare depot: BelongsTo<typeof Depot>

  @belongsTo(() => Produit, { foreignKey: 'produitId' })
  declare produit: BelongsTo<typeof Produit>
}
