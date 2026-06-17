import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'depot_stocks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('depot_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('depots')
        .onDelete('RESTRICT')
      table
        .integer('produit_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('produits')
        .onDelete('RESTRICT')
      table.decimal('quantite', 15, 3).notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['depot_id', 'produit_id'])
      table.index(['produit_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
