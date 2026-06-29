import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'achat_lignes'

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
        .from('achat_lignes as al')
        .join('achats as a', 'a.id', 'al.achat_id')
        .whereNull('al.depot_id')
        .whereNotNull('a.depot_id')
        .select('al.id as ligne_id', 'a.depot_id')

      for (const ligne of lignes) {
        await db.from('achat_lignes').where('id', ligne.ligne_id).update({ depot_id: ligne.depot_id })
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
