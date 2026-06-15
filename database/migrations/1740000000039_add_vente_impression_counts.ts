import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('ventes', (table) => {
      table.integer('facture_impression_count').notNullable().defaultTo(0)
      table.integer('bon_sortie_impression_count').notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable('ventes', (table) => {
      table.dropColumn('facture_impression_count')
      table.dropColumn('bon_sortie_impression_count')
    })
  }
}
