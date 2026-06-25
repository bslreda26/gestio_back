import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reglements'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('vente_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('ventes')
        .onDelete('RESTRICT')
      table
        .integer('paiement_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('paiements')
        .onDelete('RESTRICT')

      table.index(['vente_id'])
      table.unique(['paiement_id'])
    })

    await this.defer(async () => {
      const { backfillReglementsFromPaiementsVente } = await import('#services/reglement_service')
      await backfillReglementsFromPaiementsVente()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['paiement_id'])
      table.dropColumn('paiement_id')
      table.dropColumn('vente_id')
    })
  }
}
