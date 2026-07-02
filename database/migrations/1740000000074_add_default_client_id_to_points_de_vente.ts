import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('points_de_vente', (table) => {
      table
        .integer('default_client_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('clients')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('points_de_vente', (table) => {
      table.dropForeign(['default_client_id'])
      table.dropColumn('default_client_id')
    })
  }
}
