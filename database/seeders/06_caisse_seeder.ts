import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    const now = new Date()
    const pos = await this.client.from('points_de_vente').where('code', '01').first()
    if (!pos) return
    const pointDeVenteId = pos.id as number

    const exists = await this.client
      .from('caisses')
      .where('point_de_vente_id', pointDeVenteId)
      .first()

    if (!exists) {
      await this.client.table('caisses').insert({
        nom: 'Caisse principale',
        point_de_vente_id: pointDeVenteId,
        solde_actuel: 0,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
    }
  }
}
