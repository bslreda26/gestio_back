import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.from('ventes').where('statut', 'facture').update({ statut: 'f.invalide' })
    await this.db.from('ventes').where('statut', 'facture_valide').update({ statut: 'f.valide' })
    await this.db.from('ventes').where('statut', 'annulee').update({ statut: 'annuler' })
  }

  async down() {
    await this.db.from('ventes').where('statut', 'f.invalide').update({ statut: 'facture' })
    await this.db.from('ventes').where('statut', 'f.valide').update({ statut: 'facture_valide' })
    await this.db.from('ventes').where('statut', 'annuler').update({ statut: 'annulee' })
  }
}
