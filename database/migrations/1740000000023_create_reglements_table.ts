import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reglements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('type', 15).notNullable()
      table
        .integer('point_de_vente_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('points_de_vente')
        .onDelete('RESTRICT')
      table
        .integer('client_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('clients')
        .onDelete('RESTRICT')
      table
        .integer('fournisseur_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('fournisseurs')
        .onDelete('RESTRICT')
      table.decimal('montant', 15, 2).notNullable()
      table.decimal('solde_avant', 15, 2).notNullable()
      table.decimal('solde_apres', 15, 2).notNullable()
      table.string('mode_paiement', 20).notNullable()
      table.date('date_reglement').notNullable()
      table.string('reference_externe', 100).nullable()
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

      table.index(['type'])
      table.index(['point_de_vente_id'])
      table.index(['client_id'])
      table.index(['fournisseur_id'])
      table.index(['date_reglement'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
