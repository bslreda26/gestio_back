import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('produits', (table) => {
      table.dropForeign(['fournisseur_id'])
      table.dropColumn('fournisseur_id')
    })
  }

  async down() {
    this.schema.alterTable('produits', (table) => {
      table.integer('fournisseur_id').unsigned().nullable()
    })

    this.defer(async (db) => {
      await db.schema.alterTable('produits', (table) => {
        table
          .foreign('fournisseur_id')
          .references('id')
          .inTable('fournisseurs')
          .onDelete('SET NULL')
      })
    })
  }
}
