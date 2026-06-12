import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class DepenseCategory extends BaseModel {
  static table = 'depense_categories'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare libelle: string

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
