import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.defer(async () => {
      const { backfillFournisseurSoldesFromMovements } = await import(
        '#services/fournisseur_solde_service'
      )
      await backfillFournisseurSoldesFromMovements()
    })
  }

  async down() {}
}
