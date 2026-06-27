import { test } from '@japa/runner'
import Client from '#models/client'
import Depot from '#models/depot'
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

  test('imports stock with depot code quantity plancher and designation', async ({
    client,
    assert,
  }) => {
    const token = await loginAsAdmin(client)
    const defaultDepot = await Depot.query().where('is_default', true).firstOrFail()
    const ref = await Produit.findByOrFail('code', 'PRD-0001')

    const filePath = await buildExcelFile(
      ['Code', 'Désignation', 'Dépôt', 'Quantité', 'Plancher', 'TVA', 'AIRSI'],
      [
        ['PRD-ERP-100', 'Produit import test', defaultDepot.code, 25, 1500, 18, 1.5],
        [ref.code, ref.nom, defaultDepot.code, 42, 999, 9, 2],
      ]
    )

    try {
      const response = await authedPos(client, token)
        .post('/api/v1/imports/stock')
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

      const tva18 = await TvaGroupe.findByOrFail('code', 'TVA18')
      const tva9 = await TvaGroupe.findByOrFail('code', 'TVA9')
      assert.equal(imported.tvaGroupeId, tva18.id)
      assert.equal(Number(imported.airsiPct), 1.5)

      const depotStock = await DepotStock.query()
        .where('produit_id', imported.id)
        .where('depot_id', defaultDepot.id)
        .firstOrFail()
      assert.equal(Number(depotStock.quantite), 25)

      await ref.refresh()
      const refDepotStock = await DepotStock.query()
        .where('produit_id', ref.id)
        .where('depot_id', defaultDepot.id)
        .firstOrFail()
      assert.equal(Number(refDepotStock.quantite), 42)
      assert.equal(Number(ref.plancher), 999)
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
