import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('vente_lignes', (table) => {
      table.decimal('marge', 15, 2).notNullable().defaultTo(0)
    })

    this.defer(async (db) => {
      await db.rawQuery(
        'UPDATE vente_lignes SET marge = prix_unitaire - plancher_ligne'
      )
    })
  }

  async down() {
    this.schema.alterTable('vente_lignes', (table) => {
      table.dropColumn('marge')
    })
  }
}
