import { test } from '@japa/runner'
import Produit from '#models/produit'
import User from '#models/user'
import { DateTime } from 'luxon'
import {
  authedPos,
  DEFAULT_POINT_DE_VENTE_ID,
  loginAsAdmin,
} from '../helpers/auth.js'
import { withIsolatedTest } from '../helpers/setup.js'

async function loginAsUser(
  client: Parameters<typeof loginAsAdmin>[0],
  email: string,
  password: string
) {
  const response = await client.post('/api/v1/auth/login').json({ email, password })
  response.assertStatus(200)
  return (response.body() as { data: { token: string } }).data.token
}

test.group('API — document date permission', (group) => {
  group.each.setup(withIsolatedTest)

  test('user without documents_date_libre cannot create devis with past date', async ({
    client,
    assert,
  }) => {
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const user = await User.create({
      nom: 'Date',
      prenom: 'Bloquee',
      fullName: 'Date Bloquee',
      email: 'date.bloquee@test.local',
      password: 'Test@12345',
      role: 'caissier',
      pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
      permissions: ['ventes', 'ventes_write'],
      isActive: true,
    })

    const token = await loginAsUser(client, user.email, 'Test@12345')
    const pastDate = DateTime.now().minus({ days: 1 }).toISODate()!

    const response = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'devis',
      client_id: 1,
      date_vente: pastDate,
      lignes: [{ produit_id: produit.id, quantite: 1 }],
    })

    response.assertStatus(403)
    assert.match((response.body() as { message: string }).message, /date.*jour/i)
  })

  test('user without documents_date_libre can create devis with today date', async ({
    client,
  }) => {
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const user = await User.create({
      nom: 'Date',
      prenom: 'Aujourdhui',
      fullName: 'Date Aujourdhui',
      email: 'date.aujourdhui@test.local',
      password: 'Test@12345',
      role: 'caissier',
      pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
      permissions: ['ventes', 'ventes_write'],
      isActive: true,
    })

    const token = await loginAsUser(client, user.email, 'Test@12345')
    const today = DateTime.now().toISODate()!

    const response = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'devis',
      client_id: 1,
      date_vente: today,
      lignes: [{ produit_id: produit.id, quantite: 1 }],
    })

    response.assertStatus(200)
  })

  test('user with documents_date_libre can create devis with past date', async ({ client }) => {
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const user = await User.create({
      nom: 'Date',
      prenom: 'Libre',
      fullName: 'Date Libre',
      email: 'date.libre@test.local',
      password: 'Test@12345',
      role: 'caissier',
      pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
      permissions: ['ventes', 'ventes_write', 'documents_date_libre'],
      isActive: true,
    })

    const token = await loginAsUser(client, user.email, 'Test@12345')
    const pastDate = DateTime.now().minus({ days: 3 }).toISODate()!

    const response = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'devis',
      client_id: 1,
      date_vente: pastDate,
      lignes: [{ produit_id: produit.id, quantite: 1 }],
    })

    response.assertStatus(200)
  })

  test('admin can create devis with past date', async ({ client }) => {
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const token = await loginAsAdmin(client)
    const pastDate = DateTime.now().minus({ days: 5 }).toISODate()!

    const response = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'devis',
      client_id: 1,
      date_vente: pastDate,
      lignes: [{ produit_id: produit.id, quantite: 1 }],
    })

    response.assertStatus(200)
  })

  test('permission catalog includes documents_date_libre', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const catalog = await client
      .post('/api/v1/users/permissions-catalog')
      .bearerToken(token)
      .json({})

    catalog.assertStatus(200)
    const keys = catalog
      .body()
      .data.groups.flatMap((g: { permissions: Array<{ key: string }> }) =>
        g.permissions.map((p) => p.key)
      )
    assert.include(keys, 'documents_date_libre')
  })
})
