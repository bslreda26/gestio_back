import { test } from '@japa/runner'
import User from '#models/user'
import Produit from '#models/produit'
import { authedPos, DEFAULT_POINT_DE_VENTE_ID, loginAsAdmin, openCaisse } from '../helpers/auth.js'
import { withIsolatedTest } from '../helpers/setup.js'

test.group('API — users', (group) => {
  group.each.setup(withIsolatedTest)

  test('admin can create and list users', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)

    const create = await client.post('/api/v1/users/create').bearerToken(token).json({
      nom: 'Kouassi',
      prenom: 'Jean',
      email: 'jean.kouassi@test.local',
      password: 'Test@12345',
      role: 'caissier',
      point_de_vente_id: DEFAULT_POINT_DE_VENTE_ID,
    })

    create.assertStatus(200)
    const created = create.body().data
    assert.equal(created.email, 'jean.kouassi@test.local')
    assert.equal(created.role, 'caissier')
    assert.notProperty(created, 'password')

    const search = await client.post('/api/v1/users/search').bearerToken(token).json({
      page: 1,
      limit: 20,
      email: 'jean.kouassi@test.local',
    })

    search.assertStatus(200)
    assert.isAtLeast(search.body().data.length, 1)
  })

  test('admin can list permission catalog and update user permissions', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)

    const catalog = await client
      .post('/api/v1/users/permissions-catalog')
      .bearerToken(token)
      .json({})
    catalog.assertStatus(200)
    assert.isAbove(catalog.body().data.groups.length, 0)

    const create = await client.post('/api/v1/users/create').bearerToken(token).json({
      nom: 'Acces',
      prenom: 'Test',
      email: 'acces.test@test.local',
      password: 'Test@12345',
      role: 'caissier',
      point_de_vente_id: DEFAULT_POINT_DE_VENTE_ID,
    })
    create.assertStatus(200)
    const userId = create.body().data.id

    const update = await client.post('/api/v1/users/permissions/update').bearerToken(token).json({
      id: userId,
      permissions: ['dashboard', 'ventes', 'ventes_paiement', 'caisse'],
    })
    update.assertStatus(200)
    assert.sameMembers(update.body().data.user.permissions, [
      'dashboard',
      'ventes',
      'ventes_paiement',
      'caisse',
    ])

    const show = await client.post('/api/v1/users/permissions/show').bearerToken(token).json({
      id: userId,
    })
    show.assertStatus(200)
    assert.sameMembers(show.body().data.effective, [
      'dashboard',
      'ventes',
      'ventes_paiement',
      'caisse',
    ])
  })
})

test.group('API — vente lock', (group) => {
  group.each.setup(withIsolatedTest)

  test('second user cannot lock the same devis', async ({ client, assert }) => {
    const adminToken = await loginAsAdmin(client)

    const caissier = await User.create({
      email: 'caissier.lock@test.local',
      password: 'Test@12345',
      nom: 'Lock',
      prenom: 'Caissier',
      fullName: 'Caissier Lock',
      role: 'caissier',
      pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
      isActive: true,
    })

    const caissierLogin = await client.post('/api/v1/auth/login').json({
      email: caissier.email,
      password: 'Test@12345',
    })
    caissierLogin.assertStatus(200)
    const caissierToken = (caissierLogin.body() as { data: { token: string } }).data.token

    const create = await authedPos(client, adminToken).post('/api/v1/ventes/create').json({
      statut: 'devis',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: 1, quantite: 1, prix_unitaire: 20000 }],
    })
    create.assertStatus(200)
    const venteId = (create.body() as { data: { vente: { id: number } } }).data.vente.id

    const lock1 = await authedPos(client, adminToken)
      .post('/api/v1/ventes/lock')
      .json({ id: venteId })
    lock1.assertStatus(200)
    assert.isTrue(
      (lock1.body() as { data: { lock: { is_locked_by_me: boolean } } }).data.lock.is_locked_by_me
    )

    const lock2 = await authedPos(client, caissierToken)
      .post('/api/v1/ventes/lock')
      .json({ id: venteId })
    lock2.assertStatus(409)
    const lock2Body = lock2.body() as { message: string; data?: { locked_by: unknown } }
    assert.match(lock2Body.message, /déjà ouvert/i)
    assert.exists(lock2Body.data?.locked_by)
  })

  test('update requires lock held by current user', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)

    const create = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'devis',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: 1, quantite: 1, prix_unitaire: 20000 }],
    })
    create.assertStatus(200)
    const venteId = (create.body() as { data: { vente: { id: number } } }).data.vente.id

    const updateWithoutLock = await authedPos(client, token)
      .post('/api/v1/ventes/update')
      .json({
        id: venteId,
        notes: 'Sans verrou',
      })
    updateWithoutLock.assertStatus(409)

    await authedPos(client, token).post('/api/v1/ventes/lock').json({ id: venteId })

    const updateWithLock = await authedPos(client, token)
      .post('/api/v1/ventes/update')
      .json({
        id: venteId,
        notes: 'Avec verrou',
      })
    updateWithLock.assertStatus(200)
    assert.equal(
      (updateWithLock.body() as { data: { vente: { notes: string } } }).data.vente.notes,
      'Avec verrou'
    )
  })

  test('retour acquires lock automatically without prior lock call', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')

    const create = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'non_valide',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: produit.id, quantite: 2, prix_unitaire: 15000 }],
    })
    create.assertStatus(200)
    const factureId = (create.body() as { data: { vente: { id: number } } }).data.vente.id
    const ligneId = (create.body() as { data: { lignes: { id: number }[] } }).data.lignes[0].id

    const retour = await authedPos(client, token).post('/api/v1/ventes/retour').json({
      facture_id: factureId,
      lignes: [{ ligne_id: ligneId, quantite: 1 }],
    })
    retour.assertStatus(200)
    assert.equal(
      (retour.body() as { data: { retour: { statut: string } } }).data.retour.statut,
      'retour'
    )
  })
})
