import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.from('ventes').where('statut', 'f.invalide').update({ statut: 'non_valide' })
    await this.db.from('ventes').where('statut', 'f.valide').update({ statut: 'valide' })
    await this.db.from('ventes').where('statut', 'facture_retour').update({ statut: 'retour' })

    const annules = await this.db.from('ventes').where('statut', 'annuler').select('id')
    for (const row of annules) {
      await this.db.from('vente_lignes').where('vente_id', row.id).delete()
      await this.db.from('ventes').where('id', row.id).delete()
    }
  }

  async down() {
    await this.db.from('ventes').where('statut', 'non_valide').update({ statut: 'f.invalide' })
    await this.db.from('ventes').where('statut', 'valide').update({ statut: 'f.valide' })
    await this.db.from('ventes').where('statut', 'retour').update({ statut: 'facture_retour' })
  }
}
