import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('ventes', (table) => {
      table.integer('facture_origine_id').unsigned().nullable()
    })

    this.schema.alterTable('vente_lignes', (table) => {
      table.decimal('quantite_retournee', 15, 3).notNullable().defaultTo(0)
      table.integer('ligne_origine_id').unsigned().nullable()
    })

    this.defer(async (db) => {
      await db.schema.alterTable('ventes', (table) => {
        table
          .foreign('facture_origine_id')
          .references('id')
          .inTable('ventes')
          .onDelete('SET NULL')
      })
      await db.schema.alterTable('vente_lignes', (table) => {
        table
          .foreign('ligne_origine_id')
          .references('id')
          .inTable('vente_lignes')
          .onDelete('SET NULL')
      })
    })
  }

  async down() {
    this.schema.alterTable('vente_lignes', (table) => {
      table.dropColumn('quantite_retournee')
      table.dropColumn('ligne_origine_id')
    })
    this.schema.alterTable('ventes', (table) => {
      table.dropColumn('facture_origine_id')
    })
  }
}
