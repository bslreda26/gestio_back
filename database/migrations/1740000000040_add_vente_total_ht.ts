import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('ventes', (table) => {
      table.decimal('total_ht', 15, 2).notNullable().defaultTo(0)
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE ventes v
        SET total_ht = COALESCE((
          SELECT SUM(vl.montant_ht)
          FROM vente_lignes vl
          WHERE vl.vente_id = v.id
        ), 0)
      `)
    })
  }

  async down() {
    this.schema.alterTable('ventes', (table) => {
      table.dropColumn('total_ht')
    })
  }
}
