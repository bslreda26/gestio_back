import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ventes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('montant_timbre', 15, 2).notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('montant_timbre')
    })
  }
}
