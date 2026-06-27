import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'inventaire_saisie_lignes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('mode_vente_entree', 10).nullable()
      table.string('mode_vente_sortie', 10).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('mode_vente_entree')
      table.dropColumn('mode_vente_sortie')
    })
  }
}
