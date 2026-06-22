import { test } from '@japa/runner'
import Client from '#models/client'
import Fournisseur from '#models/fournisseur'
import Produit from '#models/produit'
import User from '#models/user'
import Vente from '#models/vente'
import Caisse from '#models/caisse'
import { authedPos, DEFAULT_POINT_DE_VENTE_ID, loginAsAdmin, openCaisse } from '../helpers/auth.js'
import { calcCmupHt, calcPlancher, calcTtc } from '#services/pricing_service'
import TvaGroupe from '#models/tva_groupe'
import { withIsolatedTest } from '../helpers/setup.js'

test.group('API — auth & health', (group) => {
  group.each.setup(withIsolatedTest)

  test('health endpoint is public', async ({ client }) => {
    const response = await client.get('/health')
    response.assertStatus(200)
    response.assertBodyContains({ status: 'ok' })
  })

  test('login returns token for admin', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    assert.isString(token)
  })

  test('invalid login returns 401 in French', async ({ client }) => {
    const response = await client.post('/api/v1/auth/login').json({
      email: 'admin@gestion.com',
      password: 'wrong-password',
    })

    response.assertStatus(401)
    response.assertBodyContains({ message: 'Identifiants invalides' })
  })

  test('login is rate limited after repeated failures', async ({ client, assert }) => {
    const payload = { email: 'admin@gestion.com', password: 'wrong-password' }

    for (let i = 0; i < 5; i++) {
      const attempt = await client.post('/api/v1/auth/login').json(payload)
      attempt.assertStatus(401)
    }

    const blocked = await client.post('/api/v1/auth/login').json(payload)
    blocked.assertStatus(429)
    const body = blocked.body() as { message: string }
    assert.match(body.message.toLowerCase(), /trop de tentatives/)
  })

  test('protected route rejects missing token', async ({ client }) => {
    const response = await client.post('/api/v1/clients/search').json({ page: 1, limit: 5 })
    response.assertStatus(401)
  })
})

test.group('API — ventes & stock', (group) => {
  group.each.setup(withIsolatedTest)

  test('vente ligne-info returns produit prix de vente', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0001')

    const response = await authedPos(client, token)
      .post('/api/v1/ventes/ligne-info')
      .json({ produit_id: produit.id, quantite: 2 })

    response.assertStatus(200)
    const data = response.body().data
    assert.equal(data.prix_unitaire, Number(produit.prixVenteTtc))
    assert.equal(data.prix_vente_ttc, Number(produit.prixVenteTtc))
    assert.equal(data.quantite, 2)
  })

  test('devis create uses produit prix de vente when prix_unitaire omitted', async ({
    client,
    assert,
  }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')

    const response = await authedPos(client, token)
      .post('/api/v1/ventes/create')
      .json({
        statut: 'devis',
        client_id: 1,
        date_vente: '2026-06-10',
        lignes: [{ produit_id: produit.id, quantite: 1 }],
      })

    response.assertStatus(200)
    assert.equal(
      response.body().data.lignes[0].prixUnitaire,
      Number(produit.prixVenteTtc)
    )
  })

  test('devis does not change stock', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produitBefore = await Produit.findByOrFail('code', 'PRD-0001')
    const stockBefore = Number(produitBefore.stockActuel)

    const response = await authedPos(client, token)
      .post('/api/v1/ventes/create')
      .json({
        statut: 'devis',
        client_id: 1,
        date_vente: '2026-06-10',
        lignes: [{ produit_id: produitBefore.id, quantite: 1, prix_unitaire: 20000 }],
      })

    response.assertStatus(200)
    await produitBefore.refresh()
    assert.equal(Number(produitBefore.stockActuel), stockBefore)
  })

  test('facture is rejected when caisse is closed', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')

    const response = await authedPos(client, token)
      .post('/api/v1/ventes/create')
      .json({
        statut: 'non_valide',
        client_id: 1,
        date_vente: '2026-06-10',
        lignes: [{ produit_id: produit.id, quantite: 1, prix_unitaire: 15000 }],
      })

    response.assertStatus(422)
    const body = response.body() as { message: string }
    assert.match(body.message.toLowerCase(), /caisse n'est pas ouverte/)
  })

  test('facture rejects duplicate product on same invoice', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')

    const response = await authedPos(client, token)
      .post('/api/v1/ventes/create')
      .json({
        statut: 'non_valide',
        client_id: 1,
        date_vente: '2026-06-10',
        lignes: [
          { produit_id: produit.id, quantite: 1, prix_unitaire: 15000 },
          { produit_id: produit.id, quantite: 2, prix_unitaire: 15000 },
        ],
      })

    response.assertStatus(422)
    const body = response.body() as { message: string }
    assert.match(body.message.toLowerCase(), /même article/)
  })

  test('devis allows duplicate product on same document', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')

    const response = await authedPos(client, token)
      .post('/api/v1/ventes/create')
      .json({
        statut: 'devis',
        client_id: 1,
        date_vente: '2026-06-10',
        lignes: [
          { produit_id: produit.id, quantite: 1 },
          { produit_id: produit.id, quantite: 2 },
        ],
      })

    response.assertStatus(200)
    assert.equal(response.body().data.lignes.length, 2)
  })

  test('unvalidated facture can be deleted and restores stock', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const clientRecord = await Client.findOrFail(1)
    const stockBefore = Number(produit.stockActuel)
    const soldeBefore = Number(clientRecord.solde)

    const create = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'non_valide',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: produit.id, quantite: 2, prix_unitaire: 15000 }],
    })
    create.assertStatus(200)
    const factureId = create.body().data.vente.id
    const totalTtc = Number(create.body().data.vente.totalTtc)

    await produit.refresh()
    await clientRecord.refresh()
    assert.equal(Number(produit.stockActuel), stockBefore - 2)
    assert.equal(Number(clientRecord.solde), soldeBefore + totalTtc)

    await authedPos(client, token).post('/api/v1/ventes/lock').json({ id: factureId })

    const deleted = await authedPos(client, token).post('/api/v1/ventes/delete').json({ id: factureId })
    deleted.assertStatus(200)

    await produit.refresh()
    await clientRecord.refresh()
    assert.equal(Number(produit.stockActuel), stockBefore)

    const show = await authedPos(client, token).post('/api/v1/ventes/show').json({ id: factureId })
    show.assertStatus(404)
  })

  test('unvalidated facture can be updated', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const stockBefore = Number(produit.stockActuel)

    const create = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'non_valide',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: produit.id, quantite: 1, prix_unitaire: 15000 }],
    })
    create.assertStatus(200)
    const factureId = create.body().data.vente.id

    await authedPos(client, token).post('/api/v1/ventes/lock').json({ id: factureId })

    const updated = await authedPos(client, token).post('/api/v1/ventes/update').json({
      id: factureId,
      lignes: [{ produit_id: produit.id, quantite: 3, prix_unitaire: 15000 }],
    })
    updated.assertStatus(200)
    assert.equal(Number(updated.body().data.lignes[0].quantite), 3)

    await produit.refresh()
    assert.equal(Number(produit.stockActuel), stockBefore - 3)
  })

  test('validated facture cannot be deleted', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')

    const create = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'non_valide',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: produit.id, quantite: 1, prix_unitaire: 15000 }],
    })
    create.assertStatus(200)
    const factureId = create.body().data.vente.id

    await authedPos(client, token).post('/api/v1/ventes/lock').json({ id: factureId })
    await authedPos(client, token).post('/api/v1/ventes/valider').json({ id: factureId })
    await authedPos(client, token).post('/api/v1/ventes/lock').json({ id: factureId })

    const deleted = await authedPos(client, token).post('/api/v1/ventes/delete').json({ id: factureId })
    deleted.assertStatus(422)
    const body = deleted.body() as { message: string }
    assert.match(body.message.toLowerCase(), /validée/)
  })

  test('facture decreases stock', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const stockBefore = Number(produit.stockActuel)

    const response = await authedPos(client, token)
      .post('/api/v1/ventes/create')
      .json({
        statut: 'non_valide',
        client_id: 1,
        date_vente: '2026-06-10',
        lignes: [{ produit_id: produit.id, quantite: 1, prix_unitaire: 15000 }],
      })

    response.assertStatus(200)
    await produit.refresh()
    assert.equal(Number(produit.stockActuel), stockBefore - 1)
  })

  test('rapport marge aggregates sales per product on period', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')

    const create = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'non_valide',
      client_id: 1,
      date_vente: '2026-06-15',
      lignes: [{ produit_id: produit.id, quantite: 2, prix_unitaire: 15000 }],
    })
    create.assertStatus(200)
    const factureId = create.body().data.vente.id

    await authedPos(client, token).post('/api/v1/ventes/lock').json({ id: factureId })
    const valider = await authedPos(client, token).post('/api/v1/ventes/valider').json({ id: factureId })
    valider.assertStatus(200)

    const rapport = await authedPos(client, token).post('/api/v1/rapports/marge').json({
      date_debut: '2026-06-01',
      date_fin: '2026-06-30',
      produit_id: produit.id,
      page: 1,
      limit: 10,
    })
    rapport.assertStatus(200)

    const ligne = rapport.body().data.lignes[0]
    assert.exists(ligne)
    assert.equal(ligne.code, produit.code)
    assert.isAbove(ligne.chiffreAffaires, 0)
    assert.isAbove(ligne.margeMontant, 0)
    assert.isAbove(ligne.margePct, 0)
    assert.equal(ligne.plancher, Number(Number(produit.plancher).toFixed(2)))
    assert.equal(rapport.body().data.totaux.chiffreAffaires, ligne.chiffreAffaires)
  })

  test('vente au detail decrements stock in detail units', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    const ref = await Produit.findByOrFail('code', 'PRD-0001')

    const created = await authedPos(client, token).post('/api/v1/produits/create').json({
      nom: 'Riz 50kg test',
      tva_groupe_id: ref.tvaGroupeId,
      prix_vente_ttc: 25000,
      unite: 'kg',
      unite_gros: 'sac',
      contenance: 50,
      vente_au_detail: true,
    })
    created.assertStatus(200)
    const produitId = created.body().data.id as number

    await authedPos(client, token).post('/api/v1/produits/ajustement').json({
      id: produitId,
      type: 'entree',
      quantite: 250,
      notes: '5 sacs',
    })

    const vente = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'non_valide',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: produitId, quantite: 1, mode_vente: 'detail' }],
    })
    vente.assertStatus(200)
    const ligne = vente.body().data.lignes[0]
    assert.equal(ligne.modeVente, 'detail')
    assert.equal(ligne.quantite, 1)
    assert.equal(ligne.quantiteStock, 1)

    const produit = await Produit.findOrFail(produitId)
    assert.equal(Number(produit.stockActuel), 249)

    const show = await authedPos(client, token).post('/api/v1/produits/show').json({ id: produitId })
    const p = show.body().data.produit
    assert.equal(p.stockPieces, 4)
    assert.equal(p.stockResteDetail, 49)
    assert.equal(p.stockLabel, '4 sac + 49 kg')
  })

  test('vente au detail ignores plancher and accepts any price', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    const ref = await Produit.findByOrFail('code', 'PRD-0001')

    const created = await authedPos(client, token).post('/api/v1/produits/create').json({
      nom: 'Riz plancher detail test',
      tva_groupe_id: ref.tvaGroupeId,
      prix_vente_ttc: 25000,
      unite: 'kg',
      unite_gros: 'sac',
      contenance: 50,
      vente_au_detail: true,
    })
    created.assertStatus(200)
    const produitId = created.body().data.id as number

    await authedPos(client, token).post('/api/v1/produits/ajustement').json({
      id: produitId,
      type: 'entree',
      quantite: 50,
    })

    const prixBas = 100
    const vente = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'non_valide',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [
        {
          produit_id: produitId,
          quantite: 1,
          mode_vente: 'detail',
          prix_unitaire: prixBas,
        },
      ],
    })
    vente.assertStatus(200)
    const ligne = vente.body().data.lignes[0]
    assert.equal(ligne.modeVente, 'detail')
    assert.equal(ligne.prixUnitaire, prixBas)
    assert.equal(ligne.plancher, 0)
  })

  test('vente par piece decrements stock by contenance', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    const ref = await Produit.findByOrFail('code', 'PRD-0001')

    const created = await authedPos(client, token).post('/api/v1/produits/create').json({
      nom: 'Riz piece test',
      tva_groupe_id: ref.tvaGroupeId,
      prix_vente_ttc: 25000,
      unite: 'kg',
      unite_gros: 'sac',
      contenance: 50,
      vente_au_detail: true,
    })
    created.assertStatus(200)
    const produitId = created.body().data.id as number

    await authedPos(client, token).post('/api/v1/produits/ajustement').json({
      id: produitId,
      type: 'entree',
      quantite: 250,
    })

    const vente = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'non_valide',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: produitId, quantite: 1, mode_vente: 'piece' }],
    })
    vente.assertStatus(200)
    assert.equal(vente.body().data.lignes[0].quantiteStock, 50)

    const produit = await Produit.findOrFail(produitId)
    assert.equal(Number(produit.stockActuel), 200)
  })

  test('vente ligne plancher matches current produit plancher', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0001')

    const ligneInfo = await authedPos(client, token).post('/api/v1/ventes/ligne-info').json({
      produit_id: produit.id,
      quantite: 1,
      mode_vente: 'piece',
    })
    ligneInfo.assertStatus(200)
    assert.equal(Number(ligneInfo.body().data.plancher), Number(produit.plancher))

    const create = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'devis',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: produit.id, quantite: 1 }],
    })
    create.assertStatus(200)
    const venteId = create.body().data.vente.id

    const show = await authedPos(client, token).post('/api/v1/ventes/show').json({ id: venteId })
    show.assertStatus(200)
    assert.equal(Number(show.body().data.lignes[0].plancher), Number(produit.plancher))
  })

  test('admin sees marge on vente lignes', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0001')
    const prixUnitaire = 15000
    const prixVenteTtc = Number(produit.prixVenteTtc)
    const plancher = Number(produit.plancher)

    const create = await authedPos(client, token)
      .post('/api/v1/ventes/create')
      .json({
        statut: 'devis',
        client_id: 1,
        date_vente: '2026-06-10',
        lignes: [{ produit_id: produit.id, quantite: 1, prix_unitaire: prixUnitaire }],
      })

    create.assertStatus(200)
    const ligne = create.body().data.lignes[0]
    assert.equal(ligne.prixUnitaire, prixUnitaire)
    assert.equal(ligne.marge, prixUnitaire - plancher)
  })

  test('admin sees marge and marge_pct on vente facture', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0001')
    const prixUnitaire = 15000
    const plancher = Number(produit.plancher)

    const create = await authedPos(client, token)
      .post('/api/v1/ventes/create')
      .json({
        statut: 'devis',
        client_id: 1,
        date_vente: '2026-06-10',
        lignes: [{ produit_id: produit.id, quantite: 2, prix_unitaire: prixUnitaire }],
      })

    create.assertStatus(200)
    const venteId = create.body().data.vente.id

    const show = await authedPos(client, token).post('/api/v1/ventes/show').json({ id: venteId })
    show.assertStatus(200)
    const vente = show.body().data.vente
    const expectedMarge = (prixUnitaire - plancher) * 2
    assert.equal(vente.marge, expectedMarge)
    assert.equal(vente.margePct, Math.round((expectedMarge / vente.totalTtc) * 10000) / 100)
  })

  test('gerant with permission sees marge and plancher on vente lignes', async ({ client, assert }) => {
    const adminToken = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0001')
    const prixUnitaire = 15000
    const prixVenteTtc = Number(produit.prixVenteTtc)
    const plancher = Number(produit.plancher)

    const create = await authedPos(client, adminToken).post('/api/v1/ventes/create').json({
      statut: 'devis',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: produit.id, quantite: 1, prix_unitaire: prixUnitaire }],
    })
    create.assertStatus(200)
    const venteId = create.body().data.vente.id

    const gerant = await User.create({
      email: 'gerant.marge@test.local',
      password: 'Test@12345',
      nom: 'Gest',
      prenom: 'Marge',
      fullName: 'Gest Marge',
      role: 'gerant',
      pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
      isActive: true,
    })

    const login = await client.post('/api/v1/auth/login').json({
      email: gerant.email,
      password: 'Test@12345',
    })
    login.assertStatus(200)
    const token = login.body().data.token

    const show = await authedPos(client, token).post('/api/v1/ventes/show').json({ id: venteId })
    show.assertStatus(200)
    const ligne = show.body().data.lignes[0]
    assert.equal(ligne.marge, prixUnitaire - plancher)
    assert.equal(ligne.plancher, plancher)
  })

  test('user without ligne permissions does not see marge or plancher', async ({ client, assert }) => {
    const adminToken = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0001')

    const create = await authedPos(client, adminToken).post('/api/v1/ventes/create').json({
      statut: 'devis',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: produit.id, quantite: 1, prix_unitaire: 15000 }],
    })
    create.assertStatus(200)
    const venteId = create.body().data.vente.id

    const facturation = await User.create({
      email: 'facturation.sans.marge@test.local',
      password: 'Test@12345',
      nom: 'Fact',
      prenom: 'SansMarge',
      fullName: 'Fact SansMarge',
      role: 'facturation',
      pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
      permissions: ['ventes'],
      isActive: true,
    })

    const login = await client.post('/api/v1/auth/login').json({
      email: facturation.email,
      password: 'Test@12345',
    })
    login.assertStatus(200)
    const token = login.body().data.token

    const show = await authedPos(client, token).post('/api/v1/ventes/show').json({ id: venteId })
    show.assertStatus(200)
    const ligne = show.body().data.lignes[0]
    assert.notProperty(ligne, 'marge')
    assert.notProperty(ligne, 'plancher')
    assert.notProperty(show.body().data.vente, 'marge')
    assert.notProperty(show.body().data.vente, 'margePct')
  })

  test('user with ligne marge but without marge pct permission sees marge only', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0001')
    const prixUnitaire = 15000
    const plancher = Number(produit.plancher)

    const create = await authedPos(client, adminToken).post('/api/v1/ventes/create').json({
      statut: 'devis',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: produit.id, quantite: 2, prix_unitaire: prixUnitaire }],
    })
    create.assertStatus(200)
    const venteId = create.body().data.vente.id

    const user = await User.create({
      email: 'facturation.marge.sans.pct@test.local',
      password: 'Test@12345',
      nom: 'Fact',
      prenom: 'MargeSansPct',
      fullName: 'Fact MargeSansPct',
      role: 'facturation',
      pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
      permissions: ['ventes', 'ventes_ligne_marge'],
      isActive: true,
    })

    const login = await client.post('/api/v1/auth/login').json({
      email: user.email,
      password: 'Test@12345',
    })
    login.assertStatus(200)
    const token = login.body().data.token

    const show = await authedPos(client, token).post('/api/v1/ventes/show').json({ id: venteId })
    show.assertStatus(200)
    const vente = show.body().data.vente
    assert.property(vente, 'marge')
    assert.equal(vente.marge, (prixUnitaire - plancher) * 2)
    assert.notProperty(vente, 'margePct')
  })

  test('custom ventes_marge_pct permission exposes margePct on vente', async ({ client, assert }) => {
    const adminToken = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0001')

    const create = await authedPos(client, adminToken).post('/api/v1/ventes/create').json({
      statut: 'devis',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: produit.id, quantite: 1, prix_unitaire: 15000 }],
    })
    create.assertStatus(200)
    const venteId = create.body().data.vente.id

    const user = await User.create({
      email: 'facturation.marge.pct@test.local',
      password: 'Test@12345',
      nom: 'Fact',
      prenom: 'MargePct',
      fullName: 'Fact MargePct',
      role: 'facturation',
      pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
      permissions: ['ventes', 'ventes_marge_pct'],
      isActive: true,
    })

    const login = await client.post('/api/v1/auth/login').json({
      email: user.email,
      password: 'Test@12345',
    })
    login.assertStatus(200)
    const token = login.body().data.token

    const show = await authedPos(client, token).post('/api/v1/ventes/show').json({ id: venteId })
    show.assertStatus(200)
    const vente = show.body().data.vente
    assert.notProperty(vente, 'marge')
    assert.property(vente, 'margePct')
  })

  test('facture below plancher is rejected', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    const produit = await Produit.findByOrFail('code', 'PRD-0001')

    const response = await authedPos(client, token)
      .post('/api/v1/ventes/create')
      .json({
        statut: 'non_valide',
        client_id: 1,
        date_vente: '2026-06-10',
        lignes: [{ produit_id: produit.id, quantite: 1, prix_unitaire: 10000 }],
      })

    response.assertStatus(422)
    const body = response.body() as unknown as { message: string }
    assert.match(body.message.toLowerCase(), /plancher/)
  })

  test('facture numero includes point de vente code', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')

    const response = await authedPos(client, token)
      .post('/api/v1/ventes/create')
      .json({
        statut: 'devis',
        client_id: 1,
        date_vente: '2026-06-10',
        lignes: [{ produit_id: produit.id, quantite: 1, prix_unitaire: 15000 }],
      })

    response.assertStatus(200)
    const numero = response.body().data.vente.numero as string
    assert.match(numero, /^01-DEV-\d{4}-\d{4}$/)
  })

  test('imprimer facture returns pdf and tracks duplicata', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')

    const create = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'non_valide',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: produit.id, quantite: 1, prix_unitaire: 15000 }],
    })
    create.assertStatus(200)
    const factureId = create.body().data.vente.id

    const first = await authedPos(client, token).post('/api/v1/ventes/imprimer').json({
      id: factureId,
      type: 'facture',
    })
    first.assertStatus(200)
    assert.equal(first.headers()['content-type'], 'application/pdf')
    assert.equal(first.headers()['x-impression-numero'], '1')
    assert.equal(first.headers()['x-impression-label'], '1')
    assert.isAbove(Number(first.headers()['content-length'] ?? 0), 100)

    const second = await authedPos(client, token).post('/api/v1/ventes/imprimer').json({
      id: factureId,
      type: 'facture',
    })
    second.assertStatus(200)
    assert.equal(second.headers()['x-impression-numero'], '2')
    assert.equal(second.headers()['x-impression-label'], 'DUPLICATA')

    const bonInvalid = await authedPos(client, token).post('/api/v1/ventes/imprimer').json({
      id: factureId,
      type: 'bon_sortie',
    })
    bonInvalid.assertStatus(422)

    await authedPos(client, token).post('/api/v1/ventes/lock').json({ id: factureId })
    await authedPos(client, token).post('/api/v1/ventes/valider').json({ id: factureId })

    const bon = await authedPos(client, token).post('/api/v1/ventes/imprimer').json({
      id: factureId,
      type: 'bon_sortie',
    })
    bon.assertStatus(200)
    assert.equal(bon.headers()['x-impression-numero'], '1')
    assert.isAbove(Number(bon.headers()['content-length'] ?? 0), 100)

    const vente = await Vente.findOrFail(factureId)
    assert.equal(vente.factureImpressionCount, 2)
    assert.equal(vente.bonSortieImpressionCount, 1)
  })
})

test.group('API — caisse & depenses', (group) => {
  group.each.setup(withIsolatedTest)

  test('caisse sessions get-by-criteria returns paged sessions in date range', async ({
    client,
    assert,
  }) => {
    const token = await loginAsAdmin(client)

    await authedPos(client, token)
      .post('/api/v1/caisse/ouverture')
      .json({ montant: 10000 })
    await authedPos(client, token)
      .post('/api/v1/caisse/fermeture')
      .json({ montant: 10000 })

    const response = await authedPos(client, token)
      .post('/api/v1/caisse/sessions/get-by-criteria')
      .json({
        page: 1,
        limit: 10,
        date_from: '2026-01-01',
        date_to: '2026-12-31',
        statut: 'fermee',
      })

    response.assertStatus(200)
    assert.isArray(response.body().data.sessions)
    assert.isAtLeast(response.body().data.sessions.length, 1)
    assert.property(response.body(), 'meta')
    assert.isAtLeast(response.body().meta.total, 1)
  })

  test('caisse session records ouverture fermeture and movements', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)

    const ouverture = await authedPos(client, token)
      .post('/api/v1/caisse/ouverture')
      .json({ montant: 50000, notes: 'Debut journee' })
    ouverture.assertStatus(200)
    const sessionId = ouverture.body().data.session.id as number

    const depense = await authedPos(client, token).post('/api/v1/depenses/create').json({
      libelle: 'Depense session test',
      categorie: 'fournitures',
      montant: 2000,
      date_depense: '2026-06-10',
    })
    depense.assertStatus(200)

    const sessionAvantFermeture = await authedPos(client, token)
      .post('/api/v1/caisse/session')
      .json({})
    sessionAvantFermeture.assertStatus(200)
    assert.equal(sessionAvantFermeture.body().data.session.id, sessionId)
    assert.equal(sessionAvantFermeture.body().data.totaux.nombreMouvements, 2)

    const fermeture = await authedPos(client, token)
      .post('/api/v1/caisse/fermeture')
      .json({ montant: 48000, notes: 'Fin journee' })
    fermeture.assertStatus(200)
    assert.equal(fermeture.body().data.session.statut, 'fermee')
    assert.equal(fermeture.body().data.session.montantOuverture, 50000)
    assert.equal(fermeture.body().data.session.montantFermeture, 48000)
    assert.equal(fermeture.body().data.caisse.soldeActuel, 48000)

    const sessionDetail = await authedPos(client, token)
      .post('/api/v1/caisse/sessions/show')
      .json({ id: sessionId })
    sessionDetail.assertStatus(200)
    assert.equal(sessionDetail.body().data.session.statut, 'fermee')
    assert.isAtLeast(sessionDetail.body().data.mouvements.length, 2)
  })

  test('depense creates caisse sortie', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    const caisseBefore = await Caisse.query().where('nom', 'Caisse principale').firstOrFail()
    const soldeBefore = Number(caisseBefore.soldeActuel)

    const create = await authedPos(client, token).post('/api/v1/depenses/create').json({
      libelle: 'Test depense Japa',
      categorie: 'fournitures',
      montant: 1000,
      date_depense: '2026-06-10',
    })

    create.assertStatus(200)
    await caisseBefore.refresh()
    assert.equal(Number(caisseBefore.soldeActuel), soldeBefore - 1000)
  })

  test('depense is rejected when caisse session is closed', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    await authedPos(client, token).post('/api/v1/caisse/fermeture').json({ montant: 0 })

    const response = await authedPos(client, token).post('/api/v1/depenses/create').json({
      libelle: 'Depense caisse fermee',
      categorie: 'fournitures',
      montant: 500,
      date_depense: '2026-06-10',
    })

    response.assertStatus(422)
    assert.match(response.body().message.toLowerCase(), /caisse n'est pas ouverte/)
  })
})

test.group('API — reglements', (group) => {
  group.each.setup(withIsolatedTest)

  test('reglement client positif diminue solde client et augmente caisse', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    const dbClient = await Client.findByOrFail('code', 'CLI-0001')
    dbClient.solde = 10000
    await dbClient.save()

    const caisseBefore = await Caisse.query().where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID).firstOrFail()
    const caisseSoldeBefore = Number(caisseBefore.soldeActuel)

    const response = await authedPos(client, token).post('/api/v1/reglements/client/create').json({
      client_id: dbClient.id,
      montant: 4000,
      mode_paiement: 'especes',
      date_reglement: '2026-06-10',
    })

    response.assertStatus(200)
    await dbClient.refresh()
    await caisseBefore.refresh()
    assert.equal(Number(dbClient.solde), 6000)
    assert.equal(Number(caisseBefore.soldeActuel), caisseSoldeBefore + 4000)
  })

  test('reglement client negatif augmente solde client et diminue caisse', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token, 50000)
    const dbClient = await Client.findByOrFail('code', 'CLI-0001')
    dbClient.solde = 2000
    await dbClient.save()

    const caisseBefore = await Caisse.query().where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID).firstOrFail()
    const caisseSoldeBefore = Number(caisseBefore.soldeActuel)

    const response = await authedPos(client, token).post('/api/v1/reglements/client/create').json({
      client_id: dbClient.id,
      montant: -1500,
      mode_paiement: 'especes',
      date_reglement: '2026-06-10',
    })

    response.assertStatus(200)
    await dbClient.refresh()
    await caisseBefore.refresh()
    assert.equal(Number(dbClient.solde), 3500)
    assert.equal(Number(caisseBefore.soldeActuel), caisseSoldeBefore - 1500)
  })

  test('reglement fournisseur positif diminue solde fournisseur et diminue caisse', async ({
    client,
    assert,
  }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token, 50000)
    const fournisseur = await Fournisseur.findByOrFail('code', 'FRN-0001')
    fournisseur.solde = 8000
    await fournisseur.save()

    const caisseBefore = await Caisse.query().where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID).firstOrFail()
    const caisseSoldeBefore = Number(caisseBefore.soldeActuel)

    const response = await authedPos(client, token).post('/api/v1/reglements/fournisseur/create').json({
      fournisseur_id: fournisseur.id,
      montant: 3000,
      mode_paiement: 'especes',
      date_reglement: '2026-06-10',
    })

    response.assertStatus(200)
    await fournisseur.refresh()
    await caisseBefore.refresh()
    assert.equal(Number(fournisseur.solde), 5000)
    assert.equal(Number(caisseBefore.soldeActuel), caisseSoldeBefore - 3000)
  })

  test('reglement client is rejected when caisse session is closed', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    await authedPos(client, token).post('/api/v1/caisse/fermeture').json({ montant: 0 })
    const dbClient = await Client.findByOrFail('code', 'CLI-0001')

    const response = await authedPos(client, token).post('/api/v1/reglements/client/create').json({
      client_id: dbClient.id,
      montant: 1000,
      mode_paiement: 'virement',
      date_reglement: '2026-06-10',
    })

    response.assertStatus(422)
    assert.match(response.body().message.toLowerCase(), /caisse n'est pas ouverte/)
  })

  test('reglement fournisseur is rejected when caisse session is closed', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)
    await authedPos(client, token).post('/api/v1/caisse/fermeture').json({ montant: 0 })
    const fournisseur = await Fournisseur.findByOrFail('code', 'FRN-0001')

    const response = await authedPos(client, token)
      .post('/api/v1/reglements/fournisseur/create')
      .json({
        fournisseur_id: fournisseur.id,
        montant: 1000,
        mode_paiement: 'cheque',
        date_reglement: '2026-06-10',
      })

    response.assertStatus(422)
    assert.match(response.body().message.toLowerCase(), /caisse n'est pas ouverte/)
  })
})

test.group('API — stock', (group) => {
  group.each.setup(withIsolatedTest)

  test('ajustement accepts quantite_pieces and quantite_detail', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const ref = await Produit.findByOrFail('code', 'PRD-0001')

    const created = await authedPos(client, token).post('/api/v1/produits/create').json({
      nom: 'Riz ajustement sac kg',
      tva_groupe_id: ref.tvaGroupeId,
      prix_vente_ttc: 25000,
      unite: 'kg',
      unite_gros: 'sac',
      contenance: 50,
      vente_au_detail: true,
    })
    created.assertStatus(200)
    const produitId = created.body().data.id as number

    const entree = await authedPos(client, token).post('/api/v1/produits/ajustement').json({
      id: produitId,
      type: 'entree',
      quantite_pieces: 5,
      quantite_detail: 12,
      notes: '5 sacs + 12 kg',
    })
    entree.assertStatus(200)
    assert.equal(entree.body().data.stockActuel, 262)
    assert.equal(entree.body().data.stockPieces, 5)
    assert.equal(entree.body().data.stockResteDetail, 12)
    assert.equal(entree.body().data.stockLabel, '5 sac + 12 kg')

    const sortie = await authedPos(client, token).post('/api/v1/produits/ajustement').json({
      id: produitId,
      type: 'sortie',
      quantite_pieces: 2,
      quantite_detail: 12,
    })
    sortie.assertStatus(200)
    assert.equal(sortie.body().data.stockActuel, 150)
    assert.equal(sortie.body().data.stockPieces, 3)
    assert.equal(sortie.body().data.stockResteDetail, 0)
  })

  test('ajustement accepts mode_vente piece and detail', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const ref = await Produit.findByOrFail('code', 'PRD-0001')

    const created = await authedPos(client, token).post('/api/v1/produits/create').json({
      nom: 'Riz ajustement mode vente',
      tva_groupe_id: ref.tvaGroupeId,
      prix_vente_ttc: 25000,
      unite: 'kg',
      unite_gros: 'sac',
      contenance: 50,
      vente_au_detail: true,
    })
    created.assertStatus(200)
    const produitId = created.body().data.id as number

    const entreeGros = await authedPos(client, token).post('/api/v1/produits/ajustement').json({
      id: produitId,
      type: 'entree',
      quantite: 5,
      mode_vente: 'piece',
    })
    entreeGros.assertStatus(200)
    assert.equal(entreeGros.body().data.stockActuel, 250)
    assert.equal(entreeGros.body().data.stockPieces, 5)

    const sortieDetail = await authedPos(client, token).post('/api/v1/produits/ajustement').json({
      id: produitId,
      type: 'sortie',
      quantite: 12,
      mode_vente: 'detail',
    })
    sortieDetail.assertStatus(200)
    assert.equal(sortieDetail.body().data.stockActuel, 238)
    assert.equal(sortieDetail.body().data.stockPieces, 4)
    assert.equal(sortieDetail.body().data.stockResteDetail, 38)
  })

  test('valorisation returns total and categories', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const response = await authedPos(client, token).get('/api/v1/stock/valorisation')

    response.assertStatus(200)
    const body = response.body().data
    assert.isNumber(body.totalValeur)
    assert.isArray(body.parCategorie)
  })
})

test.group('API — retours & caisse', (group) => {
  group.each.setup(withIsolatedTest)

  test('vente retour paiement especes creates caisse sortie', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token, 100000)
    const caisse = await Caisse.query().where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID).firstOrFail()
    const soldeAfterOpen = Number(caisse.soldeActuel)

    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const facture = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'non_valide',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: produit.id, quantite: 1, prix_unitaire: 15000 }],
    })
    facture.assertStatus(200)
    const factureId = facture.body().data.vente.id
    const ligneId = facture.body().data.lignes[0].id

    const retour = await authedPos(client, token).post('/api/v1/ventes/retour').json({
      facture_id: factureId,
      lignes: [{ ligne_id: ligneId, quantite: 1 }],
    })
    retour.assertStatus(200)
    const retourId = retour.body().data.retour.id
    const montantRetour = Number(retour.body().data.retour.totalTtc)

    await authedPos(client, token).post('/api/v1/ventes/lock').json({ id: retourId })

    const paiement = await authedPos(client, token).post('/api/v1/ventes/paiement').json({
      vente_id: retourId,
      montant: montantRetour,
      mode_paiement: 'especes',
      date_paiement: '2026-06-10',
    })
    paiement.assertStatus(200)

    await caisse.refresh()
    assert.equal(Number(caisse.soldeActuel), soldeAfterOpen - montantRetour)
  })

  test('achat retour decreases stock and paiement especes increases caisse', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token, 200000)
    const caisse = await Caisse.query().where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID).firstOrFail()
    const soldeAfterOpen = Number(caisse.soldeActuel)

    const produit = await Produit.findByOrFail('code', 'PRD-0001')
    const fournisseur = await Fournisseur.findByOrFail('code', 'FRN-0001')
    const stockBefore = Number(produit.stockActuel)

    const create = await authedPos(client, token).post('/api/v1/achats/create').json({
      fournisseur_id: fournisseur.id,
      date_achat: '2026-06-10',
      lignes: [{ produit_id: produit.id, quantite: 5, prix_unitaire_ht: 12000 }],
    })
    create.assertStatus(200)
    const achatId = create.body().data.achat.id
    const ligneId = create.body().data.lignes[0].id

    const recevoir = await authedPos(client, token).post('/api/v1/achats/recevoir').json({
      id: achatId,
      date_reception: '2026-06-10',
      lignes: [{ ligne_id: ligneId, quantite_recue: 5 }],
    })
    recevoir.assertStatus(200)

    const retour = await authedPos(client, token).post('/api/v1/achats/retour').json({
      achat_id: achatId,
      lignes: [{ ligne_id: ligneId, quantite: 2 }],
    })
    retour.assertStatus(200)
    const retourId = retour.body().data.retour.id
    const montantRetour = Number(retour.body().data.retour.totalTtc)

    await produit.refresh()
    assert.equal(Number(produit.stockActuel), stockBefore + 3)

    const paiement = await authedPos(client, token).post('/api/v1/achats/paiement').json({
      achat_id: retourId,
      montant: montantRetour,
      mode_paiement: 'especes',
      date_paiement: '2026-06-10',
    })
    paiement.assertStatus(200)

    await caisse.refresh()
    assert.equal(Number(caisse.soldeActuel), soldeAfterOpen + montantRetour)
  })

  test('achat en gros increments stock in detail units', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const fournisseur = await Fournisseur.findByOrFail('code', 'FRN-0001')

    const produitRes = await authedPos(client, token).post('/api/v1/produits/create').json({
      code: 'PRD-ACHAT-GROS',
      nom: 'Riz achat gros test',
      categorie_id: 1,
      tva_groupe_id: 1,
      unite: 'kg',
      unite_gros: 'sac',
      contenance: 50,
      vente_au_detail: true,
      stock_actuel: 100,
      prix_achat_ht: 10000,
      prix_vente_ht: 15000,
      frais: 500,
    })
    produitRes.assertStatus(200)
    const produitId = produitRes.body().data.id
    const produitAvant = await Produit.findOrFail(produitId)
    const stockBefore = Number(produitAvant.stockActuel)

    const create = await authedPos(client, token).post('/api/v1/achats/create').json({
      fournisseur_id: fournisseur.id,
      date_achat: '2026-06-10',
      lignes: [{ produit_id: produitId, quantite: 2, prix_unitaire_ht: 10000 }],
    })
    create.assertStatus(200)
    const achatId = create.body().data.achat.id
    const ligne = create.body().data.lignes[0]
    assert.equal(Number(ligne.frais), 500)
    assert.equal(ligne.modeAchat, 'piece')
    assert.equal(Number(ligne.quantiteStock), 100)

    const recevoir = await authedPos(client, token).post('/api/v1/achats/recevoir').json({
      id: achatId,
      lignes: [{ ligne_id: ligne.id, quantite_recue: 2 }],
    })
    recevoir.assertStatus(200)

    const produit = await Produit.findOrFail(produitId)
    assert.equal(Number(produit.stockActuel), stockBefore + 100)
  })

  test('achat ligne-info uses last achat price in gros', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const fournisseur = await Fournisseur.findByOrFail('code', 'FRN-0001')

    const produitRes = await authedPos(client, token).post('/api/v1/produits/create').json({
      code: 'PRD-ACHAT-PRIX',
      nom: 'Riz prix gros test',
      categorie_id: 1,
      tva_groupe_id: 1,
      unite: 'kg',
      unite_gros: 'sac',
      contenance: 50,
      vente_au_detail: true,
      prix_achat_ht: 10000,
      prix_vente_ht: 15000,
      frais: 500,
    })
    produitRes.assertStatus(200)
    const produitId = produitRes.body().data.id

    const create = await authedPos(client, token).post('/api/v1/achats/create').json({
      fournisseur_id: fournisseur.id,
      date_achat: '2026-06-10',
      lignes: [{ produit_id: produitId, quantite: 1, prix_unitaire_ht: 10000, frais: 500 }],
    })
    create.assertStatus(200)

    const recevoir = await authedPos(client, token).post('/api/v1/achats/recevoir').json({
      id: create.body().data.achat.id,
      lignes: [{ ligne_id: create.body().data.lignes[0].id, quantite_recue: 1 }],
    })
    recevoir.assertStatus(200)

    const ligneInfo = await authedPos(client, token).post('/api/v1/achats/ligne-info').json({
      produit_id: produitId,
      quantite: 1,
    })
    ligneInfo.assertStatus(200)
    const data = ligneInfo.body().data
    assert.equal(data.prix_gros_ht, 10000)
    assert.equal(data.prix_unitaire_ht, 10000)
    assert.equal(data.frais_gros, 500)
    assert.equal(data.frais, 500)
    assert.equal(data.quantite_stock, 50)
    assert.equal(data.mode_achat, 'piece')
    assert.equal(data.unite_quantite, 'sac')
    assert.equal(data.stock_label, '1 sac')
    assert.equal(data.stock_label_apres, '2 sac')
    assert.equal(data.stock_pieces_apres, 2)
  })

  test('achat reception recalculates sac product cmup in gros for catalogue display', async ({
    client,
    assert,
  }) => {
    const token = await loginAsAdmin(client)
    const fournisseur = await Fournisseur.findByOrFail('code', 'FRN-0001')
    const ref = await Produit.findByOrFail('code', 'PRD-0001')

    const produitRes = await authedPos(client, token).post('/api/v1/produits/create').json({
      code: 'PRD-CMUP-SAC',
      nom: 'Riz CMUP sac test',
      tva_groupe_id: ref.tvaGroupeId,
      unite: 'kg',
      unite_gros: 'sac',
      contenance: 50,
      vente_au_detail: true,
      prix_achat_ht: 44050,
      prix_vente_ttc: 50000,
      frais: 0,
    })
    produitRes.assertStatus(200)
    const produitId = produitRes.body().data.id

    await authedPos(client, token).post('/api/v1/produits/ajustement').json({
      id: produitId,
      type: 'entree',
      quantite: 25,
    })

    const create = await authedPos(client, token).post('/api/v1/achats/create').json({
      fournisseur_id: fournisseur.id,
      date_achat: '2026-06-10',
      lignes: [{ produit_id: produitId, quantite: 1, prix_unitaire_ht: 88000 }],
    })
    create.assertStatus(200)

    const recevoir = await authedPos(client, token).post('/api/v1/achats/recevoir').json({
      id: create.body().data.achat.id,
      lignes: [{ ligne_id: create.body().data.lignes[0].id, quantite_recue: 1 }],
    })
    recevoir.assertStatus(200)

    const produit = await Produit.findOrFail(produitId)
    const tvaGroupe = await TvaGroupe.findOrFail(ref.tvaGroupeId)
    const tauxTva = Number(tvaGroupe.taux)
    const moyenneKg = 1467
    const plancherKg = calcTtc(moyenneKg, tauxTva)
    const moyenneSac = 73350
    const plancherSac = calcTtc(moyenneSac, tauxTva)

    assert.equal(Number(produit.prixAchatHt), moyenneKg)
    assert.equal(Number(produit.plancher), plancherKg)

    const show = await authedPos(client, token).post('/api/v1/produits/show').json({ id: produitId })
    show.assertStatus(200)
    assert.equal(Number(show.body().data.produit.moyenneAchatHt), moyenneSac)
    assert.equal(Number(show.body().data.produit.plancher), plancherSac)
    assert.equal(Number(show.body().data.produit.moyenneAchatHtDetail), moyenneKg)
    assert.equal(Number(show.body().data.produit.plancherDetail), plancherKg)
    assert.equal(Number(show.body().data.produit.plancherGros), plancherSac)
  })

  test('achat paiement especes creates caisse sortie', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token, 300000)
    const caisse = await Caisse.query().where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID).firstOrFail()
    const soldeAfterOpen = Number(caisse.soldeActuel)

    const produit = await Produit.findByOrFail('code', 'PRD-0003')
    const fournisseur = await Fournisseur.findByOrFail('code', 'FRN-0001')

    const create = await authedPos(client, token).post('/api/v1/achats/create').json({
      fournisseur_id: fournisseur.id,
      date_achat: '2026-06-10',
      lignes: [{ produit_id: produit.id, quantite: 1, prix_unitaire_ht: 10000 }],
    })
    create.assertStatus(200)
    const achatId = create.body().data.achat.id
    const ligneId = create.body().data.lignes[0].id

    await authedPos(client, token).post('/api/v1/achats/recevoir').json({
      id: achatId,
      lignes: [{ ligne_id: ligneId, quantite_recue: 1 }],
    })

    const montant = Number(create.body().data.achat.totalTtc)
    const paiement = await authedPos(client, token).post('/api/v1/achats/paiement').json({
      achat_id: achatId,
      montant,
      mode_paiement: 'especes',
      date_paiement: '2026-06-10',
    })
    paiement.assertStatus(200)

    await caisse.refresh()
    assert.equal(Number(caisse.soldeActuel), soldeAfterOpen - montant)
  })
})

test.group('API — achats & plancher', (group) => {
  group.each.setup(withIsolatedTest)

  test('produit created without prices gets prix achat from achat reception', async ({
    client,
    assert,
  }) => {
    const token = await loginAsAdmin(client)
    const fournisseur = await Fournisseur.findByOrFail('code', 'FRN-0001')
    const reference = await Produit.findByOrFail('code', 'PRD-0001')

    const createProduit = await authedPos(client, token).post('/api/v1/produits/create').json({
      nom: 'Article sans prix test',
      tva_groupe_id: reference.tvaGroupeId,
    })
    createProduit.assertStatus(200)
    const produitId = createProduit.body().data.id

    const createAchat = await authedPos(client, token).post('/api/v1/achats/create').json({
      fournisseur_id: fournisseur.id,
      date_achat: '2026-06-10',
      lignes: [{ produit_id: produitId, quantite: 5, prix_unitaire_ht: 8500 }],
    })
    createAchat.assertStatus(200)

    const achatId = createAchat.body().data.achat.id
    const ligneId = createAchat.body().data.lignes[0].id

    const recevoir = await authedPos(client, token).post('/api/v1/achats/recevoir').json({
      id: achatId,
      lignes: [{ ligne_id: ligneId, quantite_recue: 5 }],
    })
    recevoir.assertStatus(200)

    const produit = await Produit.findOrFail(produitId)
    assert.equal(Number(produit.prixAchatHt), 8500)
    assert.equal(Number(produit.dernierPrixAchatHt), 8500)
    assert.equal(Number(produit.prixAchatTtc), 10030)
  })

  test('achat reception updates produit frais and recalculates plancher', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0001')
    const fournisseur = await Fournisseur.findByOrFail('code', 'FRN-0001')
    const create = await authedPos(client, token).post('/api/v1/achats/create').json({
      fournisseur_id: fournisseur.id,
      date_achat: '2026-06-10',
      lignes: [
        {
          produit_id: produit.id,
          quantite: 10,
          prix_unitaire_ht: 13000,
          frais: 700,
        },
      ],
    })
    create.assertStatus(200)

    const achatId = create.body().data.achat.id
    const ligneId = create.body().data.lignes[0].id

    const recevoir = await authedPos(client, token).post('/api/v1/achats/recevoir').json({
      id: achatId,
      date_reception: '2026-06-11',
      lignes: [{ ligne_id: ligneId, quantite_recue: 10 }],
    })
    recevoir.assertStatus(200)

    await produit.refresh()
    assert.equal(Number(produit.prixAchatHt), 12166.67)
    assert.equal(Number(produit.dernierPrixAchatHt), 13000)
    assert.equal(Number(produit.frais), 533.33)
    assert.equal(Number(produit.prixAchatTtc), 14356.67)
    assert.equal(Number(produit.plancher), 14872.72)
  })

  test('achat ligne-info pre-fills product frais over last achat frais', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const fournisseur = await Fournisseur.findByOrFail('code', 'FRN-0001')

    const produitRes = await authedPos(client, token).post('/api/v1/produits/create').json({
      code: 'PRD-ACHAT-FRAIS',
      nom: 'Produit frais achat test',
      categorie_id: 1,
      tva_groupe_id: 1,
      prix_achat_ht: 10000,
      prix_vente_ht: 15000,
      frais: 600,
    })
    produitRes.assertStatus(200)
    const produitId = produitRes.body().data.id

    const create = await authedPos(client, token).post('/api/v1/achats/create').json({
      fournisseur_id: fournisseur.id,
      date_achat: '2026-06-10',
      lignes: [{ produit_id: produitId, quantite: 5, prix_unitaire_ht: 9100, frais: 350 }],
    })
    create.assertStatus(200)

    const ligneInfo = await authedPos(client, token).post('/api/v1/achats/ligne-info').json({
      produit_id: produitId,
      quantite: 5,
    })
    ligneInfo.assertStatus(200)

    const data = ligneInfo.body().data
    assert.equal(data.prix_unitaire_ht, 9100)
    assert.equal(data.frais, 600)
    assert.equal(data.frais_gros, 600)
    assert.equal(
      data.plancher_apres,
      calcPlancher(data.prix_achat_ht_apres, data.frais_apres, data.tva_pct)
    )
  })

  test('update produit accepts prix_vente_ttc and recalculates ht', async ({
    client,
    assert,
  }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0003')
    const tvaGroupe = await TvaGroupe.findOrFail(produit.tvaGroupeId)
    const expectedPlancher = calcTtc(
      calcCmupHt(Number(produit.prixAchatHt), Number(produit.frais), Number(tvaGroupe.taux)),
      Number(tvaGroupe.taux)
    )

    const response = await authedPos(client, token).post('/api/v1/produits/update').json({
      id: produit.id,
      prix_vente_ttc: 17700,
    })
    response.assertStatus(200)

    const data = response.body().data
    assert.equal(Number(data.prixVenteTtc), 17700)
    assert.equal(Number(data.prixVenteHt), 15000)
    assert.equal(Number(data.plancher), expectedPlancher)
  })

  test('admin can manually set moyenne achat ht on produit', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0003')
    const tvaGroupe = await TvaGroupe.findOrFail(produit.tvaGroupeId)
    const tauxTva = Number(tvaGroupe.taux)
    const moyenneSaisie = 9000

    const response = await authedPos(client, token).post('/api/v1/produits/update').json({
      id: produit.id,
      moyenne_achat_ht: moyenneSaisie,
    })
    response.assertStatus(200)

    const data = response.body().data
    const frais = Number(data.frais)
    const cmup = calcCmupHt(moyenneSaisie, frais, tauxTva)

    assert.equal(Number(data.moyenneAchatHt), cmup)
    assert.equal(Number(data.prixAchatHt), moyenneSaisie)
    assert.equal(Number(data.plancher), calcTtc(cmup, tauxTva))
  })

  test('non-admin cannot manually set moyenne achat ht on produit', async ({ client, assert }) => {
    const adminToken = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0003')
    const avant = Number(produit.prixAchatHt)

    const gerant = await User.create({
      email: 'gerant.moyenne@test.local',
      password: 'Test@12345',
      nom: 'Gest',
      prenom: 'Moyenne',
      fullName: 'Gest Moyenne',
      role: 'gerant',
      pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
      isActive: true,
    })

    const login = await client.post('/api/v1/auth/login').json({
      email: gerant.email,
      password: 'Test@12345',
    })
    login.assertStatus(200)
    const token = login.body().data.token

    const response = await authedPos(client, token).post('/api/v1/produits/update').json({
      id: produit.id,
      moyenne_achat_ht: 9000,
    })
    response.assertStatus(403)

    const show = await authedPos(client, adminToken).post('/api/v1/produits/show').json({ id: produit.id })
    show.assertStatus(200)
    assert.equal(Number(show.body().data.produit.prixAchatHt), avant)
  })

  test('admin can manually set plancher on produit', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0003')

    const response = await authedPos(client, token).post('/api/v1/produits/update').json({
      id: produit.id,
      plancher: 1500,
    })
    response.assertStatus(200)
    assert.equal(Number(response.body().data.plancher), 1500)
  })

  test('non-admin cannot manually set plancher on produit', async ({ client, assert }) => {
    const adminToken = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0003')

    const gerant = await User.create({
      email: 'gerant.plancher@test.local',
      password: 'Test@12345',
      nom: 'Gest',
      prenom: 'Plancher',
      fullName: 'Gest Plancher',
      role: 'gerant',
      pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
      isActive: true,
    })

    const login = await client.post('/api/v1/auth/login').json({
      email: gerant.email,
      password: 'Test@12345',
    })
    login.assertStatus(200)
    const token = login.body().data.token

    const response = await authedPos(client, token).post('/api/v1/produits/update').json({
      id: produit.id,
      plancher: 1500,
    })
    response.assertStatus(403)

    const show = await authedPos(client, adminToken).post('/api/v1/produits/show').json({ id: produit.id })
    show.assertStatus(200)
    assert.notEqual(Number(show.body().data.produit.plancher), 1500)
  })
})
