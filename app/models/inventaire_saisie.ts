import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class InventaireSaisie extends BaseModel {
  static table = 'inventaire_saisies'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare pointDeVenteId: number

  @column()
  declare depotId: number

  @column()
  declare userId: number

  @column.date()
  declare dateSaisie: DateTime

  @column()
  declare notes: string | null

  @column()
  declare totalEntree: string

  @column()
  declare totalSortie: string

  @column()
  declare valeurEntree: string

  @column()
  declare valeurSortie: string

  @column()
  declare lignesCount: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
