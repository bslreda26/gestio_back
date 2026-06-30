import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'lettrage_lignes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('type', 20).notNullable().defaultTo('client')
      table
        .integer('fournisseur_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('fournisseurs')
        .onDelete('RESTRICT')
      table
        .integer('achat_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('achats')
        .onDelete('RESTRICT')
      table
        .integer('retour_achat_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('achats')
        .onDelete('RESTRICT')

      table.index(['type'])
      table.index(['fournisseur_id', 'point_de_vente_id'])
      table.index(['achat_id'])
      table.index(['retour_achat_id'])
    })

    this.defer(async (db) => {
      await db.from('lettrage_lignes').whereNull('type').update({ type: 'client' })
      await db.schema.alterTable(this.tableName, (table) => {
        table.integer('client_id').unsigned().nullable().alter()
        table.integer('vente_id').unsigned().nullable().alter()
      })
    })

    await this.defer(async () => {
      const { backfillLettrageFournisseurs } = await import('#services/lettrage_service')
      await backfillLettrageFournisseurs()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('retour_achat_id')
      table.dropColumn('achat_id')
      table.dropColumn('fournisseur_id')
      table.dropColumn('type')
    })
  }
}
