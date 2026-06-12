import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'caisse_mouvements'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('motif', 30).notNullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('motif', 20).notNullable().alter()
    })
  }
}
