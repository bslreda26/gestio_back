import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.from('users').where('role', 'gestionnaire').update({ role: 'gerant' })
    await this.db.from('users').where('role', 'lecteur').update({ role: 'facturation' })
  }

  async down() {
    await this.db.from('users').where('role', 'gerant').update({ role: 'gestionnaire' })
    await this.db.from('users').where('role', 'facturation').update({ role: 'lecteur' })
  }
}
