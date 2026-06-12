import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('ventes', (table) => {
      table.integer('locked_by_user_id').unsigned().nullable()
      table.timestamp('locked_at').nullable()
      table.timestamp('lock_expires_at').nullable()
    })

    this.defer(async (db) => {
      await db.schema.alterTable('ventes', (table) => {
        table
          .foreign('locked_by_user_id')
          .references('id')
          .inTable('users')
          .onDelete('SET NULL')
      })
    })
  }

  async down() {
    this.schema.alterTable('ventes', (table) => {
      table.dropColumn('locked_by_user_id')
      table.dropColumn('locked_at')
      table.dropColumn('lock_expires_at')
    })
  }
}
