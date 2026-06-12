import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'produits'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('code', 50).notNullable().unique()
      table.string('nom', 200).notNullable()
      table.text('description').nullable()
      table
        .integer('categorie_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('categories')
        .onDelete('SET NULL')
      table
        .integer('fournisseur_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('fournisseurs')
        .onDelete('SET NULL')
      table
        .integer('tva_groupe_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tva_groupes')
        .onDelete('RESTRICT')
      table.decimal('prix_achat_ht', 15, 2).notNullable().defaultTo(0)
      table.decimal('prix_achat_ttc', 15, 2).notNullable().defaultTo(0)
      table.decimal('prix_vente_ht', 15, 2).notNullable().defaultTo(0)
      table.decimal('prix_vente_ttc', 15, 2).notNullable().defaultTo(0)
      table.decimal('frais', 15, 2).notNullable().defaultTo(0)
      table.decimal('plancher', 15, 2).notNullable().defaultTo(0)
      table.string('unite', 50).notNullable().defaultTo('pièce')
      table.decimal('stock_actuel', 15, 3).notNullable().defaultTo(0)
      table.decimal('stock_minimum', 15, 3).notNullable().defaultTo(0)
      table.decimal('stock_maximum', 15, 3).notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['code'])
      table.index(['nom'])
      table.index(['categorie_id'])
      table.index(['tva_groupe_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
