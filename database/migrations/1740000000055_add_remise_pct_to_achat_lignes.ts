import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'achat_lignes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('remise_pct', 5, 2).notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('remise_pct')
    })
  }
}
