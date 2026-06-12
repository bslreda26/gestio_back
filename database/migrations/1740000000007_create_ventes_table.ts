import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ventes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('numero', 30).notNullable().unique()
      table
        .integer('client_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('clients')
        .onDelete('RESTRICT')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.integer('devis_origine_id').unsigned().nullable()
      table.date('date_vente').notNullable()
      table.date('date_echeance').nullable()
      table.string('statut', 20).notNullable().defaultTo('devis')
      table.string('statut_paiement', 20).notNullable().defaultTo('non_paye')
      table.decimal('sous_total', 15, 2).notNullable().defaultTo(0)
      table.decimal('remise_pct', 5, 2).notNullable().defaultTo(0)
      table.decimal('remise_montant', 15, 2).notNullable().defaultTo(0)
      table.decimal('tva_montant', 15, 2).notNullable().defaultTo(0)
      table.decimal('total_ttc', 15, 2).notNullable().defaultTo(0)
      table.decimal('montant_paye', 15, 2).notNullable().defaultTo(0)
      table.decimal('reste_a_payer', 15, 2).notNullable().defaultTo(0)
      table.text('notes').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['date_vente'])
      table.index(['client_id'])
      table.index(['statut'])
    })

    this.defer(async (db) => {
      await db.schema.alterTable(this.tableName, (table) => {
        table
          .foreign('devis_origine_id')
          .references('id')
          .inTable('ventes')
          .onDelete('SET NULL')
      })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
