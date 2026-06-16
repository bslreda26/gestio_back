import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('vente_lignes', (table) => {
      table.string('fne_item_id', 100).nullable()
    })
  }

  async down() {
    this.schema.alterTable('vente_lignes', (table) => {
      table.dropColumn('fne_item_id')
    })
  }
}
