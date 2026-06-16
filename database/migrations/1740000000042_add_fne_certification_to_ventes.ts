import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('ventes', (table) => {
      table.boolean('normalise').notNullable().defaultTo(false)
      table.boolean('test_normalise').notNullable().defaultTo(false)
      table.boolean('excluded').notNullable().defaultTo(false)
      table.text('api_response').nullable()
      table.string('fne_invoice_id', 100).nullable()
      table.timestamp('certified_at').nullable()

      table.decimal('airsi_pct', 5, 2).notNullable().defaultTo(0)
      table.decimal('airsi_montant', 15, 2).notNullable().defaultTo(0)
      table.decimal('total_apres_airsi', 15, 2).notNullable().defaultTo(0)
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE ventes
        SET total_apres_airsi = total_ttc
        WHERE total_apres_airsi = 0
      `)
    })
  }

  async down() {
    this.schema.alterTable('ventes', (table) => {
      table.dropColumn('normalise')
      table.dropColumn('test_normalise')
      table.dropColumn('excluded')
      table.dropColumn('api_response')
      table.dropColumn('fne_invoice_id')
      table.dropColumn('certified_at')
      table.dropColumn('airsi_pct')
      table.dropColumn('airsi_montant')
      table.dropColumn('total_apres_airsi')
    })
  }
}
