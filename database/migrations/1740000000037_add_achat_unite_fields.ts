import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('achat_lignes', (table) => {
      table.string('mode_achat', 10).notNullable().defaultTo('piece')
      table.decimal('quantite_stock', 15, 3).nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(
        'UPDATE achat_lignes SET quantite_stock = quantite WHERE quantite_stock IS NULL'
      )
    })
  }

  async down() {
    this.schema.alterTable('achat_lignes', (table) => {
      table.dropColumn('mode_achat')
      table.dropColumn('quantite_stock')
    })
  }
}
