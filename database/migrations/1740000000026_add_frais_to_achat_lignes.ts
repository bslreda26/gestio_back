import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'achat_lignes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('frais', 15, 2).notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('frais')
    })
  }
}
