import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'achat_lignes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('achat_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('achats')
        .onDelete('CASCADE')
      table
        .integer('produit_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('produits')
        .onDelete('RESTRICT')
      table.string('designation', 200).notNullable()
      table.decimal('quantite', 15, 3).notNullable()
      table.decimal('quantite_recue', 15, 3).notNullable().defaultTo(0)
      table.decimal('prix_unitaire_ht', 15, 2).notNullable()
      table.decimal('tva_pct', 5, 2).notNullable().defaultTo(0)
      table.decimal('montant_ht', 15, 2).notNullable()
      table.decimal('montant_tva', 15, 2).notNullable().defaultTo(0)
      table.decimal('montant_ttc', 15, 2).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['achat_id'])
      table.index(['produit_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
