import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.defer(async () => {
      const { annulerLettrageAutoSurRetours } = await import('#services/lettrage_service')
      await annulerLettrageAutoSurRetours()
    })
  }

  async down() {}
}
