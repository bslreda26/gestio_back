import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'achats'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('numero', 30).notNullable().unique()
      table
        .integer('fournisseur_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('fournisseurs')
        .onDelete('RESTRICT')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.date('date_achat').notNullable()
      table.date('date_reception').nullable()
      table.string('statut', 20).notNullable().defaultTo('commande')
      table.string('statut_paiement', 20).notNullable().defaultTo('non_paye')
      table.decimal('sous_total', 15, 2).notNullable().defaultTo(0)
      table.decimal('remise_montant', 15, 2).notNullable().defaultTo(0)
      table.decimal('tva_montant', 15, 2).notNullable().defaultTo(0)
      table.decimal('total_ttc', 15, 2).notNullable().defaultTo(0)
      table.decimal('montant_paye', 15, 2).notNullable().defaultTo(0)
      table.decimal('reste_a_payer', 15, 2).notNullable().defaultTo(0)
      table.string('reference_fournisseur', 100).nullable()
      table.text('notes').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['date_achat'])
      table.index(['fournisseur_id'])
      table.index(['statut'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
