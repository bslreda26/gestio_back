import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('produits', (table) => {
      table.boolean('vente_sous_plancher').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable('produits', (table) => {
      table.dropColumn('vente_sous_plancher')
    })
  }
}
