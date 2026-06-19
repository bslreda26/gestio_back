import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'fournisseur_soldes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('fournisseur_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('fournisseurs')
        .onDelete('CASCADE')
      table
        .integer('point_de_vente_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('points_de_vente')
        .onDelete('CASCADE')
      table.decimal('solde', 15, 2).notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['fournisseur_id', 'point_de_vente_id'])
      table.index(['point_de_vente_id', 'fournisseur_id'])
    })

    await this.defer(async () => {
      const { backfillFournisseurSoldesFromMovements } = await import(
        '#services/fournisseur_solde_service'
      )
      await backfillFournisseurSoldesFromMovements()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
