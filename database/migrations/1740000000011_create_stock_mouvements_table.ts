import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stock_mouvements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('produit_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('produits')
        .onDelete('RESTRICT')
      table.string('type', 20).notNullable()
      table.string('motif', 30).notNullable()
      table.decimal('quantite', 15, 3).notNullable()
      table.decimal('stock_avant', 15, 3).notNullable()
      table.decimal('stock_apres', 15, 3).notNullable()
      table.integer('reference_id').unsigned().nullable()
      table.string('reference_type', 50).nullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.text('notes').nullable()
      table.timestamp('created_at').notNullable()

      table.index(['produit_id'])
      table.index(['created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
