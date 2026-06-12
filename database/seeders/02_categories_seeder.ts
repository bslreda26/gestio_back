import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    const now = new Date()
    const pos = await this.client.from('points_de_vente').where('code', '01').first()
    if (!pos) return
    const pointDeVenteId = pos.id as number

    const categories = [
      { nom: 'Alimentation', description: 'Produits alimentaires' },
      { nom: 'Boissons', description: 'Jus, eau, sodas' },
      { nom: 'Hygiène', description: 'Produits d\'hygiène et entretien' },
      { nom: 'Électronique', description: 'Appareils et accessoires' },
      { nom: 'Fournitures', description: 'Fournitures de bureau' },
    ]

    for (const cat of categories) {
      const exists = await this.client
        .from('categories')
        .where('nom', cat.nom)
        .where('point_de_vente_id', pointDeVenteId)
        .first()
      if (!exists) {
        await this.client.table('categories').insert({
          ...cat,
          point_de_vente_id: pointDeVenteId,
          created_at: now,
          updated_at: now,
        })
      }
    }
  }
}
