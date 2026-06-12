import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    const now = new Date()
    const pos = await this.client.from('points_de_vente').where('code', '01').first()
    if (!pos) return
    const pointDeVenteId = pos.id as number

    const fournisseurExists = await this.client.from('fournisseurs').where('code', 'FRN-0001').first()
    if (!fournisseurExists) {
      await this.client.table('fournisseurs').insert({
        code: 'FRN-0001',
        nom: 'Fournisseur Principal',
        email: 'contact@fournisseur.ci',
        telephone: '+225 07 00 00 01',
        ville: 'Abidjan',
        pays: "Côte d'Ivoire",
        solde: 0,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
    }

    const clientExists = await this.client
      .from('clients')
      .where('code', 'CLI-0001')
      .where('point_de_vente_id', pointDeVenteId)
      .first()
    if (!clientExists) {
      await this.client.table('clients').insert({
        code: 'CLI-0001',
        point_de_vente_id: pointDeVenteId,
        type: 'B2C',
        nom: 'Client Démo',
        email: 'client@demo.ci',
        telephone: '+225 07 00 00 02',
        ville: 'Abidjan',
        pays: "Côte d'Ivoire",
        credit_limit: 500000,
        solde: 0,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
    }
  }
}
