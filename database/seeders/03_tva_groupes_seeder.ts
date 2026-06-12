import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    const now = new Date()
    const groupes = [
      { code: 'TVA18', libelle: 'TVA 18%', taux: 18 },
      { code: 'TVA9', libelle: 'TVA 9%', taux: 9 },
      { code: 'TVA0', libelle: 'Exonéré', taux: 0 },
    ]

    for (const groupe of groupes) {
      const exists = await this.client.from('tva_groupes').where('code', groupe.code).first()
      if (!exists) {
        await this.client.table('tva_groupes').insert({
          ...groupe,
          is_active: true,
          created_at: now,
          updated_at: now,
        })
      }
    }
  }
}
