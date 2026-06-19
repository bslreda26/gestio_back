import User from '#models/user'
import app from '@adonisjs/core/services/app'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

const DEFAULT_POINT_DE_VENTE_ID = 1

const SEED_USERS = [
  {
    nom: 'Gestion',
    prenom: 'Admin',
    fullName: 'Admin Gestion',
    email: 'admin@gestion.com',
    password: 'Admin@123456',
    role: 'admin' as const,
    pointDeVenteId: null,
  },
  {
    nom: 'Dupont',
    prenom: 'Marie',
    fullName: 'Marie Dupont',
    email: 'gerant@gestion.com',
    password: 'Gerant@123456',
    role: 'gerant' as const,
    pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
  },
  {
    nom: 'Martin',
    prenom: 'Paul',
    fullName: 'Paul Martin',
    email: 'caissier@gestion.com',
    password: 'Caissier@123456',
    role: 'caissier' as const,
    pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
  },
  {
    nom: 'Bernard',
    prenom: 'Sophie',
    fullName: 'Sophie Bernard',
    email: 'facturation@gestion.com',
    password: 'Facturation@123456',
    role: 'facturation' as const,
    pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
  },
]

export default class extends BaseSeeder {
  async run() {
    if (app.inProduction && process.env.ALLOW_DEFAULT_SEED_USERS !== 'true') {
      console.warn(
        '[01_user_seeder] Skipped in production. Set ALLOW_DEFAULT_SEED_USERS=true to override.'
      )
      return
    }

    for (const seed of SEED_USERS) {
      const existing = await User.findBy('email', seed.email)
      if (existing) {
        continue
      }

      await User.create({
        nom: seed.nom,
        prenom: seed.prenom,
        fullName: seed.fullName,
        email: seed.email,
        password: seed.password,
        role: seed.role,
        pointDeVenteId: seed.pointDeVenteId,
        permissions: null,
        isActive: true,
      })
    }
  }
}
