import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.from('achats').where('statut', 'partiel').update({ statut: 'achat' })
    await this.db.from('achats').where('statut', 'recu').update({ statut: 'achat' })
    await this.db.from('achats').where('statut', 'achat_retour').update({ statut: 'retour' })
  }

  async down() {
    await this.db.from('achats').where('statut', 'retour').update({ statut: 'achat_retour' })
    // Cannot distinguish partiel vs recu after merge — restored rows become recu
    await this.db.from('achats').where('statut', 'achat').update({ statut: 'recu' })
  }
}
