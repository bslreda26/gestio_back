import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    const { default: UserSeeder } = await import('./01_user_seeder.js')
    await new UserSeeder(this.client).run()

  }
}
