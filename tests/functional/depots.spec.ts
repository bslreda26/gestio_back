import { test } from '@japa/runner'
import Depot from '#models/depot'
import DepotStock from '#models/depot_stock'
import Produit from '#models/produit'
import { authedPos, loginAsAdmin, openCaisse } from '../helpers/auth.js'
import { withIsolatedTest } from '../helpers/setup.js'

test.group('API — dépôts & stock multi-dépôt', (group) => {
  group.each.setup(withIsolatedTest)

  test('can create a secondary depot', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)

    const response = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'ENT',
      nom: 'Entrepôt',
      adresse: 'Zone industrielle',
    })

    response.assertStatus(200)
    const depot = response.body().data
    assert.equal(depot.code, 'ENT')
    assert.equal(depot.nom, 'Entrepôt')
    assert.isFalse(depot.is_default)
    assert.isTrue(depot.is_active)
  })

  test('transfer moves stock between depots', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'MAG',
      nom: 'Magasin secondaire',
    })
    createDepot.assertStatus(200)
    const secondaryId = createDepot.body().data.id

    const stockBefore = Number(produit.stockActuel)
    assert.isAtLeast(stockBefore, 5)

    const transfert = await authedPos(client, token).post('/api/v1/depots/transfert').json({
      produit_id: produit.id,
      quantite: 5,
      depot_source_id: defaultDepot.id,
      depot_dest_id: secondaryId,
    })
    transfert.assertStatus(200)

    await produit.refresh()
    assert.equal(Number(produit.stockActuel), stockBefore)

    const sourceRow = await DepotStock.query()
      .where('depot_id', defaultDepot.id)
      .where('produit_id', produit.id)
      .firstOrFail()
    const destRow = await DepotStock.query()
      .where('depot_id', secondaryId)
      .where('produit_id', produit.id)
      .firstOrFail()

    assert.equal(Number(sourceRow.quantite), stockBefore - 5)
    assert.equal(Number(destRow.quantite), 5)
  })

  test('product show exposes per-depot stock breakdown', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'UI',
      nom: 'Dépôt UI',
    })
    const secondaryId = createDepot.body().data.id

    await authedPos(client, token).post('/api/v1/depots/transfert').json({
      produit_id: produit.id,
      quantite: 10,
      depot_source_id: defaultDepot.id,
      depot_dest_id: secondaryId,
    })

    const show = await authedPos(client, token).post('/api/v1/produits/show').json({ id: produit.id })
    show.assertStatus(200)

    const stocks = show.body().data.produit.stocksParDepot as Array<{
      depot_id: number
      quantite: number
    }>
    assert.isAtLeast(stocks.length, 2)

    const byDepot = new Map(stocks.map((s) => [s.depot_id, s.quantite]))
    assert.equal(byDepot.get(secondaryId), 10)
    assert.isAtLeast(byDepot.get(defaultDepot.id) ?? 0, 0)
  })

  test('facture deducts stock from the specified depot', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)

    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'VTE',
      nom: 'Point vente annexe',
    })
    const salesDepotId = createDepot.body().data.id

    await authedPos(client, token).post('/api/v1/depots/transfert').json({
      produit_id: produit.id,
      quantite: 8,
      depot_source_id: defaultDepot.id,
      depot_dest_id: salesDepotId,
    })

    const defaultBefore = Number(
      (
        await DepotStock.query()
          .where('depot_id', defaultDepot.id)
          .where('produit_id', produit.id)
          .firstOrFail()
      ).quantite
    )
    const salesBefore = 8

    const facture = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'non_valide',
      client_id: 1,
      date_vente: '2026-06-10',
      depot_id: salesDepotId,
      lignes: [{ produit_id: produit.id, quantite: 3, prix_unitaire: 15000 }],
    })
    facture.assertStatus(200)

    const defaultAfter = Number(
      (
        await DepotStock.query()
          .where('depot_id', defaultDepot.id)
          .where('produit_id', produit.id)
          .firstOrFail()
      ).quantite
    )
    const salesAfter = Number(
      (
        await DepotStock.query()
          .where('depot_id', salesDepotId)
          .where('produit_id', produit.id)
          .firstOrFail()
      ).quantite
    )

    assert.equal(defaultAfter, defaultBefore)
    assert.equal(salesAfter, salesBefore - 3)
  })

  test('facture rejects sale when chosen depot has insufficient stock', async ({
    client,
    assert,
  }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)

    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'VID',
      nom: 'Dépôt vide',
    })
    const emptyDepotId = createDepot.body().data.id

    await authedPos(client, token).post('/api/v1/depots/transfert').json({
      produit_id: produit.id,
      quantite: 1,
      depot_source_id: defaultDepot.id,
      depot_dest_id: emptyDepotId,
    })

    const response = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'non_valide',
      client_id: 1,
      date_vente: '2026-06-10',
      depot_id: emptyDepotId,
      lignes: [{ produit_id: produit.id, quantite: 5, prix_unitaire: 15000 }],
    })

    response.assertStatus(422)
    const body = response.body() as { message: string }
    assert.match(body.message.toLowerCase(), /stock/)
  })

  test('deactivate depot transfers stock then deactivates', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'TMP',
      nom: 'Dépôt temporaire',
    })
    const tempId = createDepot.body().data.id

    await authedPos(client, token).post('/api/v1/depots/transfert').json({
      produit_id: produit.id,
      quantite: 4,
      depot_source_id: defaultDepot.id,
      depot_dest_id: tempId,
    })

    const deactivate = await authedPos(client, token).post('/api/v1/depots/deactivate').json({
      id: tempId,
      transfer_to_depot_id: defaultDepot.id,
    })
    deactivate.assertStatus(200)
    assert.isFalse(deactivate.body().data.depot.is_active)

    const tempStock = await DepotStock.query()
      .where('depot_id', tempId)
      .where('produit_id', produit.id)
      .first()
    assert.isTrue(!tempStock || Number(tempStock.quantite) === 0)

    const defaultRow = await DepotStock.query()
      .where('depot_id', defaultDepot.id)
      .where('produit_id', produit.id)
      .firstOrFail()
    assert.isAtLeast(Number(defaultRow.quantite), 4)
  })

  test('inventaire adjusts total product stock', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'INV',
      nom: 'Dépôt inventaire',
    })
    const depotId = createDepot.body().data.id

    await authedPos(client, token).post('/api/v1/depots/transfert').json({
      produit_id: produit.id,
      quantite: 12,
      depot_source_id: defaultDepot.id,
      depot_dest_id: depotId,
    })

    await produit.refresh()
    const totalBefore = Number(produit.stockActuel)

    const inventaire = await authedPos(client, token).post('/api/v1/stock/inventaire').json({
      produit_id: produit.id,
      quantite_comptee: totalBefore - 2,
      notes: 'Écart inventaire',
    })
    inventaire.assertStatus(200)

    await produit.refresh()
    assert.equal(Number(produit.stockActuel), totalBefore - 2)
  })

  test('perte removes stock from total product stock', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'PRT',
      nom: 'Dépôt perte',
    })
    const depotId = createDepot.body().data.id

    await authedPos(client, token).post('/api/v1/depots/transfert').json({
      produit_id: produit.id,
      quantite: 7,
      depot_source_id: defaultDepot.id,
      depot_dest_id: depotId,
    })

    await produit.refresh()
    const totalBefore = Number(produit.stockActuel)

    const perte = await authedPos(client, token).post('/api/v1/stock/perte').json({
      produit_id: produit.id,
      quantite: 3,
      notes: 'Casse',
    })
    perte.assertStatus(200)

    await produit.refresh()
    assert.equal(Number(produit.stockActuel), totalBefore - 3)
  })

  test('facture retour returns stock to the specified depot', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)

    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'RET',
      nom: 'Dépôt retour',
    })
    const returnDepotId = createDepot.body().data.id

    const defaultBefore = Number(
      (
        await DepotStock.query()
          .where('depot_id', defaultDepot.id)
          .where('produit_id', produit.id)
          .firstOrFail()
      ).quantite
    )

    const facture = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'non_valide',
      client_id: 1,
      date_vente: '2026-06-10',
      lignes: [{ produit_id: produit.id, quantite: 2, prix_unitaire: 15000 }],
    })
    facture.assertStatus(200)
    const factureId = facture.body().data.vente.id
    const ligneId = facture.body().data.lignes[0].id

    const defaultAfterSale = Number(
      (
        await DepotStock.query()
          .where('depot_id', defaultDepot.id)
          .where('produit_id', produit.id)
          .firstOrFail()
      ).quantite
    )
    assert.equal(defaultAfterSale, defaultBefore - 2)

    let returnDepotRow = await DepotStock.query()
      .where('depot_id', returnDepotId)
      .where('produit_id', produit.id)
      .first()
    assert.isTrue(!returnDepotRow || Number(returnDepotRow.quantite) === 0)

    const retour = await authedPos(client, token).post('/api/v1/ventes/retour').json({
      facture_id: factureId,
      depot_id: returnDepotId,
      lignes: [{ ligne_id: ligneId, quantite: 1 }],
    })
    retour.assertStatus(200)

    const defaultAfterRetour = Number(
      (
        await DepotStock.query()
          .where('depot_id', defaultDepot.id)
          .where('produit_id', produit.id)
          .firstOrFail()
      ).quantite
    )
    returnDepotRow = await DepotStock.query()
      .where('depot_id', returnDepotId)
      .where('produit_id', produit.id)
      .firstOrFail()

    assert.equal(defaultAfterRetour, defaultBefore - 2)
    assert.equal(Number(returnDepotRow.quantite), 1)
  })

  test('stock search exposes per-depot breakdown', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'SRCH',
      nom: 'Dépôt recherche',
    })
    const secondaryId = createDepot.body().data.id

    await authedPos(client, token).post('/api/v1/depots/transfert').json({
      produit_id: produit.id,
      quantite: 6,
      depot_source_id: defaultDepot.id,
      depot_dest_id: secondaryId,
    })

    const search = await authedPos(client, token).post('/api/v1/stock/search').json({
      page: 1,
      limit: 50,
      search: produit.code,
    })
    search.assertStatus(200)

    const row = (search.body().data as Array<{ code: string; stocksParDepot: Array<{ depot_id: number; quantite: number }> }>).find(
      (p) => p.code === produit.code
    )
    assert.exists(row)
    assert.isAtLeast(row!.stocksParDepot.length, 2)

    const byDepot = new Map(row!.stocksParDepot.map((s) => [s.depot_id, s.quantite]))
    assert.equal(byDepot.get(secondaryId), 6)
  })
})
