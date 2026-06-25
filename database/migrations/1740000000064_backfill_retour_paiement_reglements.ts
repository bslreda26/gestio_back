import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.defer(async () => {
      const { backfillReglementsFromPaiementsVente } = await import('#services/reglement_service')
      await backfillReglementsFromPaiementsVente()
    })
  }

  async down() {}
}
