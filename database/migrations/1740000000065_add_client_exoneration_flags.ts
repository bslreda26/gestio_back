import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'clients'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('exonere_tva').notNullable().defaultTo(false)
      table.boolean('exonere_airsi').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('exonere_tva')
      table.dropColumn('exonere_airsi')
    })
  }
}
