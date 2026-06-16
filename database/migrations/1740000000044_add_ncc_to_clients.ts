import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('clients', (table) => {
      table.string('ncc', 50).nullable()
      table.index(['ncc'])
    })
  }

  async down() {
    this.schema.alterTable('clients', (table) => {
      table.dropIndex(['ncc'])
      table.dropColumn('ncc')
    })
  }
}
