import { CategorySchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Produit from '#models/produit'

export default class Category extends CategorySchema {
  @hasMany(() => Produit, { foreignKey: 'categorieId' })
  declare produits: HasMany<typeof Produit>
}
