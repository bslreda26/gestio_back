import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'paiements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('type', 10).notNullable()
      table.integer('reference_id').unsigned().notNullable()
      table.decimal('montant', 15, 2).notNullable()
      table.string('mode_paiement', 20).notNullable()
      table.date('date_paiement').notNullable()
      table.string('reference_paiement', 100).nullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.text('notes').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['type', 'reference_id'])
      table.index(['date_paiement'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
