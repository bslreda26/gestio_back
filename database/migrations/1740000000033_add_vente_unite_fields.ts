import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('produits', (table) => {
      table.string('unite_gros', 50).nullable()
      table.decimal('contenance', 15, 3).notNullable().defaultTo(1)
      table.boolean('vente_au_detail').notNullable().defaultTo(false)
    })

    this.schema.alterTable('vente_lignes', (table) => {
      table.string('mode_vente', 10).notNullable().defaultTo('piece')
      table.decimal('quantite_stock', 15, 3).nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery('UPDATE vente_lignes SET quantite_stock = quantite WHERE quantite_stock IS NULL')
    })
  }

  async down() {
    this.schema.alterTable('vente_lignes', (table) => {
      table.dropColumn('mode_vente')
      table.dropColumn('quantite_stock')
    })

    this.schema.alterTable('produits', (table) => {
      table.dropColumn('unite_gros')
      table.dropColumn('contenance')
      table.dropColumn('vente_au_detail')
    })
  }
}
