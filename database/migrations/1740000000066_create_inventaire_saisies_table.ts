import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'inventaire_saisies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('point_de_vente_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('points_de_vente')
        .onDelete('RESTRICT')
      table
        .integer('depot_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('depots')
        .onDelete('RESTRICT')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.date('date_saisie').notNullable()
      table.text('notes').nullable()
      table.decimal('total_entree', 15, 3).notNullable().defaultTo(0)
      table.decimal('total_sortie', 15, 3).notNullable().defaultTo(0)
      table.decimal('valeur_entree', 15, 2).notNullable().defaultTo(0)
      table.decimal('valeur_sortie', 15, 2).notNullable().defaultTo(0)
      table.integer('lignes_count').unsigned().notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['point_de_vente_id'])
      table.index(['depot_id'])
      table.index(['date_saisie'])
    })

    this.schema.createTable('inventaire_saisie_lignes', (table) => {
      table.increments('id').notNullable()
      table
        .integer('inventaire_saisie_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('inventaire_saisies')
        .onDelete('CASCADE')
      table
        .integer('produit_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('produits')
        .onDelete('RESTRICT')
      table.string('code', 50).notNullable()
      table.string('designation', 255).notNullable()
      table.decimal('quantite_actuelle', 15, 3).notNullable()
      table.decimal('entree', 15, 3).notNullable().defaultTo(0)
      table.decimal('sortie', 15, 3).notNullable().defaultTo(0)
      table.decimal('stock_apres', 15, 3).notNullable()
      table.decimal('prix_achat_ht', 15, 4).notNullable().defaultTo(0)
      table.decimal('valeur_entree', 15, 2).notNullable().defaultTo(0)
      table.decimal('valeur_sortie', 15, 2).notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()

      table.index(['inventaire_saisie_id'])
      table.index(['produit_id'])
    })
  }

  async down() {
    this.schema.dropTable('inventaire_saisie_lignes')
    this.schema.dropTable(this.tableName)
  }
}
