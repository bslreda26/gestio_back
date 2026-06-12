import { FournisseurSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Achat from '#models/achat'

export default class Fournisseur extends FournisseurSchema {
  @hasMany(() => Achat, { foreignKey: 'fournisseurId' })
  declare achats: HasMany<typeof Achat>
}
