import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'vente_lignes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('depot_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('depots')
        .onDelete('RESTRICT')
    })

    await this.defer(async (db) => {
      const lignes = await db
        .from('vente_lignes as vl')
        .join('ventes as v', 'v.id', 'vl.vente_id')
        .whereNull('vl.depot_id')
        .whereNotNull('v.depot_id')
        .select('vl.id as ligne_id', 'v.depot_id')

      for (const ligne of lignes) {
        await db.from('vente_lignes').where('id', ligne.ligne_id).update({ depot_id: ligne.depot_id })
      }
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['depot_id'])
      table.dropColumn('depot_id')
    })
  }
}
