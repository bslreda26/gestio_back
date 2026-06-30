import { test } from '@japa/runner'
import Client from '#models/client'
import DepotStock from '#models/depot_stock'
import Fournisseur from '#models/fournisseur'
import Produit from '#models/produit'
import TvaGroupe from '#models/tva_groupe'
import { authedPos, loginAsAdmin } from '../helpers/auth.js'
import { buildExcelFile, cleanupExcelFile } from '../helpers/excel.js'
import { withIsolatedTest } from '../helpers/setup.js'

test.group('API — import Excel', (group) => {
  group.each.setup(withIsolatedTest)

  test('imports clients without solde', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const filePath = await buildExcelFile(
      ['Code', 'Nom', 'Téléphone', 'Ville', 'Type'],
      [
        ['CLI-ERP-001', 'Client ERP Alpha', '0700000001', 'Abidjan', 'B2B'],
        ['CLI-ERP-002', 'Client ERP Beta', '0700000002', 'Bouaké', 'B2C'],
      ]
    )

    try {
      const response = await authedPos(client, token)
        .post('/api/v1/imports/clients')
        .file('file', filePath)

      response.assertStatus(200)
      const body = response.body() as {
        data: { total_rows: number; created: number; updated: number; errors: unknown[] }
      }
      const summary = body.data
      assert.equal(summary.total_rows, 2)
      assert.equal(summary.created, 2)
      assert.equal(summary.errors.length, 0)

      const created = await Client.query()
        .where('code', 'CLI-ERP-001')
        .where('point_de_vente_id', 1)
        .firstOrFail()

      assert.equal(created.nom, 'Client ERP Alpha')
      assert.equal(created.type, 'B2B')
      assert.equal(Number(created.solde), 0)
    } finally {
      await cleanupExcelFile(filePath)
    }
  })

  test('imports fournisseurs without solde', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const filePath = await buildExcelFile(
      ['Code', 'Nom', 'Contact', 'Ville'],
      [['FRN-ERP-001', 'Fournisseur ERP', 'Jean Dupont', 'Yamoussoukro']]
    )

    try {
      const response = await authedPos(client, token)
        .post('/api/v1/imports/fournisseurs')
        .file('file', filePath)

      response.assertStatus(200)
      const body = response.body() as {
        data: { total_rows: number; created: number; updated: number; errors: unknown[] }
      }
      const summary = body.data
      assert.equal(summary.created, 1)

      const fournisseur = await Fournisseur.findByOrFail('code', 'FRN-ERP-001')
      assert.equal(fournisseur.nom, 'Fournisseur ERP')
      assert.equal(fournisseur.contactNom, 'Jean Dupont')
      assert.equal(Number(fournisseur.solde), 0)
    } finally {
      await cleanupExcelFile(filePath)
    }
  })

  test('imports articles with code designation tva prices and stock thresholds', async ({
    client,
    assert,
  }) => {
    const token = await loginAsAdmin(client)
    const ref = await Produit.findByOrFail('code', 'PRD-0001')

    const filePath = await buildExcelFile(
      [
        'Code',
        'Désignation',
        'TVA',
        'Plancher',
        'Prix vente TTC',
        'Prix achat HT',
        'Stock min',
        'Stock max',
        'AIRSI',
      ],
      [
        ['PRD-ERP-100', 'Produit import test', 18, 1500, 2500, 1200, 5, 100, 1.5],
        [ref.code, 'Produit mis à jour', 9, 999, 1800, 900, 2, 50, 2],
      ]
    )

    try {
      const response = await authedPos(client, token)
        .post('/api/v1/imports/articles')
        .file('file', filePath)

      response.assertStatus(200)
      const body = response.body() as {
        data: { total_rows: number; created: number; updated: number; errors: unknown[] }
      }
      const summary = body.data
      assert.equal(summary.total_rows, 2)
      assert.equal(summary.created, 1)
      assert.equal(summary.updated, 1)
      assert.equal(summary.errors.length, 0)

      const imported = await Produit.query()
        .where('code', 'PRD-ERP-100')
        .where('point_de_vente_id', 1)
        .firstOrFail()

      assert.equal(imported.nom, 'Produit import test')
      assert.equal(Number(imported.plancher), 1500)
      assert.equal(Number(imported.prixVenteTtc), 2500)
      assert.equal(Number(imported.prixAchatHt), 1200)
      assert.equal(Number(imported.stockMinimum), 5)
      assert.equal(Number(imported.stockMaximum), 100)

      const tva18 = await TvaGroupe.findByOrFail('code', 'TVA18')
      const tva9 = await TvaGroupe.findByOrFail('code', 'TVA9')
      assert.equal(imported.tvaGroupeId, tva18.id)
      assert.equal(Number(imported.airsiPct), 1.5)

      await ref.refresh()
      assert.equal(ref.nom, 'Produit mis à jour')
      assert.equal(Number(ref.plancher), 999)
      assert.equal(Number(ref.prixVenteTtc), 1800)
      assert.equal(Number(ref.prixAchatHt), 900)
      assert.equal(Number(ref.stockMinimum), 2)
      assert.equal(Number(ref.stockMaximum), 50)
      assert.equal(ref.tvaGroupeId, tva9.id)
      assert.equal(Number(ref.airsiPct), 2)
    } finally {
      await cleanupExcelFile(filePath)
    }
  })

  test('rejects client row missing required code or type', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const filePath = await buildExcelFile(
      ['Code', 'Nom', 'Type'],
      [['', 'Sans code', 'B2C'], ['CLI-X', 'Sans type', '']]
    )

    try {
      const response = await authedPos(client, token)
        .post('/api/v1/imports/clients')
        .file('file', filePath)

      response.assertStatus(200)
      const body = response.body() as {
        data: { created: number; skipped: number; errors: { field?: string; message: string }[] }
      }
      const summary = body.data
      assert.equal(summary.created, 0)
      assert.equal(summary.skipped, 2)
      assert.isTrue(summary.errors.some((e) => e.field === 'code'))
      assert.isTrue(summary.errors.some((e) => e.field === 'type'))
    } finally {
      await cleanupExcelFile(filePath)
    }
  })

  test('imports inventaire quantities per depot', async ({ client, assert }) => {
    const token = await loginAsAdmin(client)
    const produit = await Produit.findByOrFail('code', 'PRD-0001')

    const createDepot = await authedPos(client, token).post('/api/v1/depots/create').json({
      code: 'IMP-INV',
      nom: 'Dépôt import inventaire',
    })
    const depotId = createDepot.body().data.id

    const filePath = await buildExcelFile(
      ['Code', 'Quantité'],
      [
        [produit.code, 25],
        ['ARTICLE-INCONNU', 10],
      ]
    )

    try {
      const response = await authedPos(client, token)
        .post('/api/v1/imports/inventaire')
        .field('depot_id', String(depotId))
        .field('notes', 'Test import inventaire')
        .file('file', filePath)

      response.assertStatus(200)
      const body = response.body() as {
        data: {
          total_rows: number
          created: number
          skipped: number
          errors: { field?: string; message: string }[]
          saisies: { depot_id: number; saisie_id: number; lignes: number }[]
        }
      }
      const summary = body.data
      assert.equal(summary.total_rows, 2)
      assert.equal(summary.created, 1)
      assert.equal(summary.skipped, 1)
      assert.isTrue(summary.errors.some((e) => e.field === 'code'))
      assert.equal(summary.saisies.length, 1)
      assert.equal(summary.saisies[0].depot_id, depotId)

      const depotStock = await DepotStock.query()
        .where('depot_id', depotId)
        .where('produit_id', produit.id)
        .firstOrFail()

      assert.equal(Number(depotStock.quantite), 25)
    } finally {
      await cleanupExcelFile(filePath)
    }
  })

  test('gerant cannot import clients', async ({ client }) => {
    const filePath = await buildExcelFile(
      ['Code', 'Nom', 'Type'],
      [['CLI-DENIED', 'Refused', 'B2C']]
    )

    try {
      const login = await client.post('/api/v1/auth/login').json({
        email: 'gerant@gestion.com',
        password: 'Gerant@123456',
      })
      login.assertStatus(200)
      const token = login.body().data.token

      const response = await authedPos(client, token)
        .post('/api/v1/imports/clients')
        .file('file', filePath)

      response.assertStatus(403)
    } finally {
      await cleanupExcelFile(filePath)
    }
  })
})
