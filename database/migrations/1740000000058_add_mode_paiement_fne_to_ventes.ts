import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ventes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('mode_paiement_fne', 20).notNullable().defaultTo('deferred')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('mode_paiement_fne')
    })
  }
}
