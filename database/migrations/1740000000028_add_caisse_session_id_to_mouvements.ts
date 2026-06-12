import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'caisse_mouvements'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('caisse_session_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('caisse_sessions')
        .onDelete('SET NULL')

      table.index(['caisse_session_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('caisse_session_id')
    })
  }
}
