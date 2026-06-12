import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'caisse_mouvements'

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
      table.string('type', 10).notNullable()
      table.string('motif', 20).notNullable()
      table.decimal('montant', 15, 2).notNullable()
      table.decimal('solde_avant', 15, 2).notNullable()
      table.decimal('solde_apres', 15, 2).notNullable()
      table.integer('reference_id').unsigned().nullable()
      table.string('reference_type', 50).nullable()
      table.string('libelle', 255).notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.dateTime('date_mouvement').notNullable()
      table.text('notes').nullable()
      table.timestamp('created_at').notNullable()

      table.index(['caisse_id'])
      table.index(['date_mouvement'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
