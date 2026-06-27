import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class InventaireSaisieLigne extends BaseModel {
  static table = 'inventaire_saisie_lignes'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare inventaireSaisieId: number

  @column()
  declare produitId: number

  @column()
  declare code: string

  @column()
  declare designation: string

  @column()
  declare quantiteActuelle: string

  @column()
  declare entree: string

  @column()
  declare sortie: string

  @column()
  declare modeVenteEntree: string | null

  @column()
  declare modeVenteSortie: string | null

  @column()
  declare stockApres: string

  @column()
  declare prixAchatHt: string

  @column()
  declare valeurEntree: string

  @column()
  declare valeurSortie: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
