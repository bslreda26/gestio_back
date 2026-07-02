import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Client from '#models/client'
import { DateTime } from 'luxon'

export default class PointDeVente extends BaseModel {
  static table = 'points_de_vente'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare nom: string

  @column()
  declare adresse: string | null

  @column()
  declare ville: string | null

  @column()
  declare telephone: string | null

  @column()
  declare isActive: boolean

  @column()
  declare pointOfSale: string | null

  @column()
  declare establishment: string | null

  @column()
  declare timbreReference: string | null

  @column()
  declare defaultClientId: number | null

  @belongsTo(() => Client, { foreignKey: 'defaultClientId' })
  declare defaultClient: BelongsTo<typeof Client>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
