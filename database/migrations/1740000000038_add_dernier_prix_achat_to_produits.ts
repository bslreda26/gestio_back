import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'produits'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .decimal('dernier_prix_achat_ht', 15, 2)
        .notNullable()
        .defaultTo(0)
        .after('prix_achat_ht')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('dernier_prix_achat_ht')
    })
  }
}
