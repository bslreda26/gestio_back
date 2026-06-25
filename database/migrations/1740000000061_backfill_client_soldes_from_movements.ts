import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.defer(async () => {
      const { backfillClientSoldesFromMovements } = await import('#services/rapport_service')
      await backfillClientSoldesFromMovements()
    })
  }

  async down() {}
}
