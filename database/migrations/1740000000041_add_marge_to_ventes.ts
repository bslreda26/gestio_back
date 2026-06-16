import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('ventes', (table) => {
      table.decimal('marge', 15, 2).notNullable().defaultTo(0)
      table.decimal('marge_pct', 8, 2).notNullable().defaultTo(0)
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE ventes v
        SET marge = ROUND(
          COALESCE((
            SELECT SUM(
              ROUND((vl.marge * vl.quantite) * (1 - vl.remise_pct / 100), 2)
            )
            FROM vente_lignes vl
            WHERE vl.vente_id = v.id
          ), 0) * CASE WHEN v.sous_total > 0 THEN v.total_ttc / v.sous_total ELSE 0 END,
          2
        )
      `)
      await db.rawQuery(`
        UPDATE ventes
        SET marge_pct = CASE
          WHEN total_ttc > 0 THEN ROUND((marge / total_ttc) * 100, 2)
          ELSE 0
        END
      `)
    })
  }

  async down() {
    this.schema.alterTable('ventes', (table) => {
      table.dropColumn('marge')
      table.dropColumn('marge_pct')
    })
  }
}
