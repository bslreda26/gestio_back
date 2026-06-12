import User from '#models/user'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    const existing = await User.findBy('email', 'admin@gestion.com')
    if (existing) {
      existing.merge({
        nom: 'Admin',
        prenom: 'Système',
        role: 'admin',
        isActive: true,
        fullName: 'Admin Système',
      })
      existing.password = 'Admin@123456'
      await existing.save()
      return
    }

    await User.create({
      email: 'admin@gestion.com',
      password: 'Admin@123456',
      nom: 'Admin',
      prenom: 'Système',
      fullName: 'Admin Système',
      role: 'admin',
      isActive: true,
    })
  }
}
