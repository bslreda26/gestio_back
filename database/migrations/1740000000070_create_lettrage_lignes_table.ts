import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'lettrage_lignes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('client_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('clients')
        .onDelete('RESTRICT')
      table
        .integer('point_de_vente_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('points_de_vente')
        .onDelete('RESTRICT')
      table
        .integer('vente_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('ventes')
        .onDelete('RESTRICT')
      table
        .integer('reglement_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('reglements')
        .onDelete('RESTRICT')
      table
        .integer('retour_vente_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('ventes')
        .onDelete('RESTRICT')
      table.decimal('montant', 15, 2).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['client_id', 'point_de_vente_id'])
      table.index(['reglement_id'])
      table.index(['retour_vente_id'])
      table.index(['vente_id'])
    })

    await this.defer(async () => {
      const { backfillLettrageClients } = await import('#services/lettrage_service')
      await backfillLettrageClients()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
