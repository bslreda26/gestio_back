import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'fournisseurs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('code', 20).notNullable().unique()
      table.string('nom', 150).notNullable()
      table.string('email', 150).nullable()
      table.string('telephone', 20).nullable()
      table.text('adresse').nullable()
      table.string('ville', 100).nullable()
      table.string('pays', 100).nullable()
      table.string('contact_nom', 150).nullable()
      table.decimal('solde', 15, 2).notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.text('notes').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['nom'])
      table.index(['code'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
