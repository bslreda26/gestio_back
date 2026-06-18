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

  test('facture deducts stock from ligne depot when it overrides header depot', async ({
    client,
    assert,
  }) => {
    const token = await loginAsAdmin(client)
    await openCaisse(client, token)

    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'L2',
      nom: 'Ligne depot override',
    })
    createDepot.assertStatus(200)
    const ligneDepotId = createDepot.body().data.id

    await authedPos(client, token).post('/api/v1/depots/transfert').json({
      produit_id: produit.id,
      quantite: 6,
      depot_source_id: defaultDepot.id,
      depot_dest_id: ligneDepotId,
    })

    const defaultBefore = Number(
      (
        await DepotStock.query()
          .where('depot_id', defaultDepot.id)
          .where('produit_id', produit.id)
          .firstOrFail()
      ).quantite
    )
    const ligneDepotBefore = 6

    const facture = await authedPos(client, token).post('/api/v1/ventes/create').json({
      statut: 'non_valide',
      client_id: 1,
      date_vente: '2026-06-10',
      depot_id: defaultDepot.id,
      lignes: [{ produit_id: produit.id, quantite: 2, prix_unitaire: 15000, depotId: ligneDepotId }],
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
    const ligneDepotAfter = Number(
      (
        await DepotStock.query()
          .where('depot_id', ligneDepotId)
          .where('produit_id', produit.id)
          .firstOrFail()
      ).quantite
    )

    assert.equal(defaultAfter, defaultBefore)
    assert.equal(ligneDepotAfter, ligneDepotBefore - 2)
    assert.equal(facture.body().data.lignes[0].depotId, ligneDepotId)
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

  test('stock search filters by depot_id in payload', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'FLT',
      nom: 'Dépôt filtre',
    })
    const secondaryId = createDepot.body().data.id

    await authedPos(client, token).post('/api/v1/depots/transfert').json({
      produit_id: produit.id,
      quantite: 4,
      depot_source_id: defaultDepot.id,
      depot_dest_id: secondaryId,
    })

    const search = await authedPos(client, token).post('/api/v1/stock/search').json({
      page: 1,
      limit: 50,
      search: produit.code,
      depot_id: secondaryId,
    })
    search.assertStatus(200)

    const row = search.body().data.find((p: { code: string }) => p.code === produit.code)
    assert.exists(row)
    assert.equal(row.stockActuel, 4)
    assert.equal(row.valeurStock, Number((4 * Number(produit.prixAchatHt)).toFixed(2)))
  })

  test('rapport valeur-stock supports depot_id and par_depot', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()
    const plancher = Number(produit.plancher)

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'VAL',
      nom: 'Dépôt valorisation',
    })
    const secondaryId = createDepot.body().data.id

    await produit.refresh()
    const transferQty = Math.min(5, Number(produit.stockActuel))
    assert.isAtLeast(transferQty, 1)

    const transfert = await authedPos(client, token).post('/api/v1/depots/transfert').json({
      produit_id: produit.id,
      quantite: transferQty,
      depot_source_id: defaultDepot.id,
      depot_dest_id: secondaryId,
    })
    transfert.assertStatus(200)

    const reportPayload = {
      depot_id: secondaryId,
      search: produit.code,
      page: 1,
      limit: 100,
    }

    const byDepot = await authedPos(client, token)
      .post('/api/v1/rapports/valeur-stock')
      .json(reportPayload)
    byDepot.assertStatus(200)

    const lignesDepot = byDepot.body().data.lignes as Array<{
      designation: string
      quantiteStock: number
      valeurGlobale: number
    }>
    const ligneDepot = lignesDepot.find((l) => l.quantiteStock === transferQty)
    assert.exists(ligneDepot)
    assert.equal(ligneDepot!.valeurGlobale, roundMoney(plancher * transferQty))
    assert.equal(byDepot.body().data.depot_id, secondaryId)
    assert.equal(byDepot.body().data.totaux.quantiteTotale, transferQty)

    const parDepot = await authedPos(client, token)
      .post('/api/v1/rapports/valeur-stock')
      .json({
        par_depot: true,
        search: produit.code,
        page: 1,
        limit: 100,
      })
    parDepot.assertStatus(200)
    assert.isTrue(parDepot.body().data.par_depot)
    assert.isArray(parDepot.body().data.totaux.valeursParDepot)
    assert.isAtLeast(parDepot.body().data.totaux.valeursParDepot.length, 2)

    const ligneParDepot = parDepot.body().data.lignes.find(
      (l: {
        valeursParDepot?: Array<{ depot_id: number; quantite: number }>
      }) => l.valeursParDepot?.some((v) => v.depot_id === secondaryId && v.quantite === transferQty)
    )
    assert.exists(ligneParDepot?.valeursParDepot)
    const depotBreakdown = new Map(
      ligneParDepot.valeursParDepot.map((v: { depot_id: number; quantite: number }) => [
        v.depot_id,
        v.quantite,
      ])
    )
    assert.equal(depotBreakdown.get(secondaryId), transferQty)
  })

  test('stock mouvements search filters by date_debut and date_fin', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'MVT',
      nom: 'Dépôt mouvements',
    })
    const secondaryId = createDepot.body().data.id

    await produit.refresh()
    const transferQty = Math.min(3, Number(produit.stockActuel))
    assert.isAtLeast(transferQty, 1)

    const transfert = await authedPos(client, token).post('/api/v1/depots/transfert').json({
      produit_id: produit.id,
      quantite: transferQty,
      depot_source_id: defaultDepot.id,
      depot_dest_id: secondaryId,
    })
    transfert.assertStatus(200)

    const today = new Date().toISOString().slice(0, 10)

    const inRange = await authedPos(client, token).post('/api/v1/stock/mouvements/search').json({
      produit_id: produit.id,
      type: 'transfert',
      date_debut: today,
      date_fin: today,
      page: 1,
      limit: 50,
    })
    inRange.assertStatus(200)
    assert.isAtLeast(inRange.body().data.mouvements.length, 1)

    const outOfRange = await authedPos(client, token).post('/api/v1/stock/mouvements/search').json({
      produit_id: produit.id,
      type: 'transfert',
      date_debut: '2020-01-01',
      date_fin: '2020-01-02',
      page: 1,
      limit: 50,
    })
    outOfRange.assertStatus(200)
    assert.equal(outOfRange.body().data.mouvements.length, 0)

    const invalidRange = await authedPos(client, token).post('/api/v1/stock/mouvements/search').json({
      date_debut: '2026-06-18',
      date_fin: '2026-06-01',
    })
    invalidRange.assertStatus(422)
  })

  test('rapport mouvements-stock shows initial entries exits and final stock', async ({
    client,
    assert,
  }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0002')
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()
    const today = new Date().toISOString().slice(0, 10)

    await produit.refresh()
    const stockBefore = Number(produit.stockActuel)

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'RPT',
      nom: 'Dépôt rapport',
    })
    const secondaryId = createDepot.body().data.id

    const transferQty = Math.min(4, stockBefore)
    assert.isAtLeast(transferQty, 1)

    const transfert = await authedPos(client, token).post('/api/v1/depots/transfert').json({
      produit_id: produit.id,
      quantite: transferQty,
      depot_source_id: defaultDepot.id,
      depot_dest_id: secondaryId,
    })
    transfert.assertStatus(200)

    const rapport = await authedPos(client, token).post('/api/v1/rapports/mouvements-stock').json({
      date_debut: today,
      date_fin: today,
      produit_id: produit.id,
      page: 1,
      limit: 10,
    })
    rapport.assertStatus(200)

    const ligne = rapport.body().data.lignes[0]
    assert.exists(ligne)
    assert.equal(ligne.code, produit.code)
    assert.equal(ligne.stockFinal, stockBefore)
    assert.equal(ligne.stockInitial + ligne.totalEntree - ligne.totalSortie, ligne.stockFinal)

    const rapportDepot = await authedPos(client, token)
      .post('/api/v1/rapports/mouvements-stock')
      .json({
        date_debut: today,
        date_fin: today,
        produit_id: produit.id,
        depot_id: secondaryId,
        page: 1,
        limit: 10,
      })
    rapportDepot.assertStatus(200)

    const ligneDepot = rapportDepot.body().data.lignes[0]
    assert.equal(ligneDepot.totalEntree, transferQty)
    assert.equal(ligneDepot.stockFinal, transferQty)
  })
})

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}
