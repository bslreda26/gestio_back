import { ClientSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Vente from '#models/vente'

export default class Client extends ClientSchema {
  @hasMany(() => Vente, { foreignKey: 'clientId' })
  declare ventes: HasMany<typeof Vente>
}
