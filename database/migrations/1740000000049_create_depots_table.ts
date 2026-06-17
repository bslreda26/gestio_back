import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'depots'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('point_de_vente_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('points_de_vente')
        .onDelete('RESTRICT')
      table.string('code', 20).notNullable()
      table.string('nom', 150).notNullable()
      table.text('adresse').nullable()
      table.boolean('is_default').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['point_de_vente_id', 'code'])
      table.index(['point_de_vente_id'])
      table.index(['is_active'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
