import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('produits', (table) => {
      table.decimal('airsi_pct', 5, 2).notNullable().defaultTo(0)
    })

    this.schema.alterTable('vente_lignes', (table) => {
      table.decimal('airsi_pct', 5, 2).notNullable().defaultTo(0)
      table.decimal('airsi_montant', 15, 2).notNullable().defaultTo(0)
      table.decimal('montant_apres_airsi', 15, 2).notNullable().defaultTo(0)
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE vente_lignes
        SET montant_apres_airsi = montant_ttc
        WHERE montant_apres_airsi = 0
      `)
    })
  }

  async down() {
    this.schema.alterTable('vente_lignes', (table) => {
      table.dropColumn('airsi_pct')
      table.dropColumn('airsi_montant')
      table.dropColumn('montant_apres_airsi')
    })

    this.schema.alterTable('produits', (table) => {
      table.dropColumn('airsi_pct')
    })
  }
}
