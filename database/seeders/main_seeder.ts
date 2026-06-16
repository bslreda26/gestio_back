import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    const { default: UserSeeder } = await import('./01_user_seeder.js')
    await new UserSeeder(this.client).run()

    const { default: ReferenceDataSeeder } = await import('./02_reference_data_seeder.js')
    await new ReferenceDataSeeder(this.client).run()

    const { default: ProduitSeeder } = await import('./03_produit_seeder.js')
    await new ProduitSeeder(this.client).run()

    const { default: AchatSeeder } = await import('./04_achat_seeder.js')
    await new AchatSeeder(this.client).run()

    const { default: VenteSeeder } = await import('./05_vente_seeder.js')
    await new VenteSeeder(this.client).run()
  }
}
