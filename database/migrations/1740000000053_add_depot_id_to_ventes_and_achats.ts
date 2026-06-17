import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('ventes', (table) => {
      table
        .integer('depot_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('depots')
        .onDelete('SET NULL')
        .after('point_de_vente_id')
    })

    this.schema.alterTable('achats', (table) => {
      table
        .integer('depot_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('depots')
        .onDelete('SET NULL')
        .after('point_de_vente_id')
    })

    await this.defer(async (db) => {
      const depots = await db.from('depots').where('is_default', true).select('id', 'point_de_vente_id')

      for (const depot of depots) {
        await db
          .from('ventes')
          .where('point_de_vente_id', depot.point_de_vente_id)
          .whereNull('depot_id')
          .update({ depot_id: depot.id })

        await db
          .from('achats')
          .where('point_de_vente_id', depot.point_de_vente_id)
          .whereNull('depot_id')
          .update({ depot_id: depot.id })
      }
    })
  }

  async down() {
    this.schema.alterTable('ventes', (table) => {
      table.dropForeign(['depot_id'])
      table.dropColumn('depot_id')
    })

    this.schema.alterTable('achats', (table) => {
      table.dropForeign(['depot_id'])
      table.dropColumn('depot_id')
    })
  }
}
