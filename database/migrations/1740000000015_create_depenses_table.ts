import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'depenses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('caisse_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('caisses')
        .onDelete('RESTRICT')
      table.string('libelle', 255).notNullable()
      table.string('categorie', 20).notNullable()
      table.decimal('montant', 15, 2).notNullable()
      table.date('date_depense').notNullable()
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

      table.index(['caisse_id'])
      table.index(['date_depense'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
