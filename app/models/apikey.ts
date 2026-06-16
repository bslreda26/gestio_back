import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class Apikey extends BaseModel {
  static table = 'apikeys'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare key: string

  @column()
  declare prodUrl: string

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
