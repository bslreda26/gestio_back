import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stock_mouvements'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('depot_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('depots')
        .onDelete('RESTRICT')
        .after('produit_id')

      table.index(['depot_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['depot_id'])
      table.dropColumn('depot_id')
    })
  }
}
