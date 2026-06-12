import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('achats', (table) => {
      table.integer('achat_origine_id').unsigned().nullable()
    })

    this.schema.alterTable('achat_lignes', (table) => {
      table.decimal('quantite_retournee', 15, 3).notNullable().defaultTo(0)
      table.integer('ligne_origine_id').unsigned().nullable()
    })

    this.defer(async (db) => {
      await db.schema.alterTable('achats', (table) => {
        table
          .foreign('achat_origine_id')
          .references('id')
          .inTable('achats')
          .onDelete('SET NULL')
      })
      await db.schema.alterTable('achat_lignes', (table) => {
        table
          .foreign('ligne_origine_id')
          .references('id')
          .inTable('achat_lignes')
          .onDelete('SET NULL')
      })
    })
  }

  async down() {
    this.schema.alterTable('achat_lignes', (table) => {
      table.dropColumn('quantite_retournee')
      table.dropColumn('ligne_origine_id')
    })
    this.schema.alterTable('achats', (table) => {
      table.dropColumn('achat_origine_id')
    })
  }
}
