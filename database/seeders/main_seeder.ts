import { BaseSeeder } from '@adonisjs/lucid/seeders'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'

export default class extends BaseSeeder {
  private async seed(Seeder: { default: new (client: QueryClientContract) => { run(): Promise<void> } }) {
    await new Seeder.default(this.client).run()
  }

  async run() {
    await this.seed(await import('./01_user_seeder.js'))
    await this.seed(await import('./02_categories_seeder.js'))
    await this.seed(await import('./03_tva_groupes_seeder.js'))
    await this.seed(await import('./04_fournisseur_client_seeder.js'))
    await this.seed(await import('./05_produits_seeder.js'))
    await this.seed(await import('./06_caisse_seeder.js'))
  }
}
