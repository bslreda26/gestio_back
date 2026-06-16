import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('points_de_vente', (table) => {
      table.string('point_of_sale', 150).nullable()
      table.string('establishment', 150).nullable()
      table.string('timbre_reference', 50).nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE points_de_vente
        SET point_of_sale = COALESCE(point_of_sale, nom),
            establishment = COALESCE(establishment, nom)
      `)
    })
  }

  async down() {
    this.schema.alterTable('points_de_vente', (table) => {
      table.dropColumn('point_of_sale')
      table.dropColumn('establishment')
      table.dropColumn('timbre_reference')
    })
  }
}
