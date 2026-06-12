import { TvaGroupeSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Produit from '#models/produit'

export default class TvaGroupe extends TvaGroupeSchema {
  @hasMany(() => Produit, { foreignKey: 'tvaGroupeId' })
  declare produits: HasMany<typeof Produit>
}
