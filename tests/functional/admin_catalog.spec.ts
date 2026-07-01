import { test } from '@japa/runner'
import User from '#models/user'
import { authedPos, DEFAULT_POINT_DE_VENTE_ID, loginAsAdmin } from '../helpers/auth.js'
import { withIsolatedTest } from '../helpers/setup.js'

test.group('API — admin catalogue', (group) => {
  group.each.setup(withIsolatedTest)

  test('admin can crud tva groupes', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)

    const create = await client.post('/api/v1/admin/tva-groupes/create').bearerToken(token).json({
      code: 'TVA5',
      libelle: 'TVA 5%',
      taux: 5,
    })
    create.assertStatus(200)
    const id = create.body().data.id
    assert.equal(create.body().data.code, 'TVA5')

    const update = await client.post('/api/v1/admin/tva-groupes/update').bearerToken(token).json({
      id,
      libelle: 'TVA réduite 5%',
    })
    update.assertStatus(200)
    assert.equal(update.body().data.libelle, 'TVA réduite 5%')

    const search = await client.post('/api/v1/admin/tva-groupes/search').bearerToken(token).json({
      page: 1,
      limit: 20,
      code: 'TVA5',
    })
    search.assertStatus(200)
    assert.isAtLeast(search.body().data.length, 1)
  })

  test('admin can crud product categories', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)

    const create = await client.post('/api/v1/admin/categories/create').bearerToken(token).json({
      nom: 'Catégorie Admin',
      description: 'Test admin',
      point_de_vente_id: DEFAULT_POINT_DE_VENTE_ID,
    })
    create.assertStatus(200)
    const id = create.body().data.id

    const update = await client.post('/api/v1/admin/categories/update').bearerToken(token).json({
      id,
      nom: 'Catégorie Admin Modifiée',
    })
    update.assertStatus(200)
    assert.equal(update.body().data.nom, 'Catégorie Admin Modifiée')

    const search = await client.post('/api/v1/admin/categories/search').bearerToken(token).json({
      page: 1,
      limit: 20,
      nom: 'Admin Modifiée',
    })
    search.assertStatus(200)
    assert.isAtLeast(search.body().data.length, 1)

    const deleted = await client.post('/api/v1/admin/categories/delete').bearerToken(token).json({ id })
    deleted.assertStatus(200)
  })

  test('non-admin with categories_admin can search without pdv in body', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsAdmin(client)

    const user = await User.create({
      email: 'categories.admin@test.local',
      password: 'Test@12345',
      nom: 'Cat',
      prenom: 'Admin',
      fullName: 'Cat Admin',
      role: 'gerant',
      pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
      permissions: ['categories_admin'],
      isActive: true,
    })

    const login = await client.post('/api/v1/auth/login').json({
      email: user.email,
      password: 'Test@12345',
    })
    login.assertStatus(200)
    const token = login.body().data.token

    const create = await client.post('/api/v1/admin/categories/create').bearerToken(token).json({
      nom: 'Catégorie Gérant',
      point_de_vente_id: DEFAULT_POINT_DE_VENTE_ID,
    })
    create.assertStatus(200)

    const search = await client.post('/api/v1/admin/categories/search').bearerToken(token).json({
      page: 1,
      limit: 20,
      nom: 'Catégorie Gérant',
    })
    search.assertStatus(200)
    assert.isAtLeast(search.body().data.length, 1)
    assert.equal(search.body().data[0].point_de_vente_id, DEFAULT_POINT_DE_VENTE_ID)

    const pdvList = await client
      .post('/api/v1/points-de-vente/search')
      .bearerToken(token)
      .json({ page: 1, limit: 20 })
    pdvList.assertStatus(403)

    await client
      .post('/api/v1/admin/categories/delete')
      .bearerToken(adminToken)
      .json({ id: create.body().data.id })
  })

  test('admin can crud depense categories', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)

    const create = await client
      .post('/api/v1/admin/depense-categories/create')
      .bearerToken(token)
      .json({
        code: 'marketing',
        libelle: 'Marketing',
      })
    create.assertStatus(200)
    const id = create.body().data.id
    assert.equal(create.body().data.code, 'marketing')

    const update = await client
      .post('/api/v1/admin/depense-categories/update')
      .bearerToken(token)
      .json({
        id,
        libelle: 'Marketing & pub',
      })
    update.assertStatus(200)
    assert.equal(update.body().data.libelle, 'Marketing & pub')

    const list = await authedPos(client, token).get('/api/v1/depense-categories')
    list.assertStatus(200)
    assert.isTrue(list.body().data.some((c: { code: string }) => c.code === 'marketing'))

    const search = await client
      .post('/api/v1/admin/depense-categories/search')
      .bearerToken(token)
      .json({ page: 1, limit: 20, code: 'marketing' })
    search.assertStatus(200)
    assert.isAtLeast(search.body().data.length, 1)

    const deleted = await client
      .post('/api/v1/admin/depense-categories/delete')
      .bearerToken(token)
      .json({ id })
    deleted.assertStatus(200)
  })
})
