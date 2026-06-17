import { VENTE_STATUT } from '#constants/vente_statuts'
import Client from '#models/client'
import PointDeVente from '#models/point_de_vente'
import {
  assertVenteCertifiable,
  buildFneInvoicePayload,
  buildFneRefundItems,
  buildFneRefundPayload,
  FneCertificationError,
} from '#services/fne_certification_service'
import Produit from '#models/produit'
import Vente from '#models/vente'
import VenteLigne from '#models/vente_ligne'
import { calculerTotauxVente, type CalculatedLigne } from '#services/vente_service'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

const sampleLigne = (): CalculatedLigne => ({
  produitId: 1,
  designation: 'Produit test',
  modeVente: 'piece',
  quantite: 2,
  quantiteStock: 2,
  prixUnitaire: 590,
  plancherLigne: 400,
  marge: 190,
  remisePct: 0,
  tvaPct: 18,
  montantHt: 1000,
  montantTva: 180,
  montantTtc: 1180,
  airsiPct: 5,
  airsiMontant: 59,
  montantApresAirsi: 1239,
})

test.group('calculerTotauxVente AIRSI', () => {
  test('adds AIRSI on top of total TTC', ({ assert }) => {
    const totaux = calculerTotauxVente([sampleLigne()], 0)

    assert.equal(totaux.totalTtc, 1180)
    assert.equal(totaux.airsiMontant, 59)
    assert.equal(totaux.totalApresAirsi, 1239)
  })

  test('computes global remise from percentage on HT and recalculates TVA', ({ assert }) => {
    const ligne: CalculatedLigne = {
      ...sampleLigne(),
      tvaPct: 9,
      montantHt: 20183,
      montantTva: 1817,
      montantTtc: 22000,
    }

    const totaux = calculerTotauxVente([ligne], 10)

    assert.equal(totaux.sousTotal, 22000)
    assert.equal(totaux.remiseMontant, 2018.3)
    assert.equal(totaux.totalHt, 18164.7)
    assert.equal(totaux.tvaMontant, 1634.82)
    assert.equal(totaux.totalTtc, 19799.52)
  })

  test('computes global remise from percentage only when TVA is zero', ({ assert }) => {
    const ligne: CalculatedLigne = {
      ...sampleLigne(),
      tvaPct: 0,
      montantHt: 250000,
      montantTva: 0,
      montantTtc: 250000,
    }

    const totaux = calculerTotauxVente([ligne], 10)

    assert.equal(totaux.sousTotal, 250000)
    assert.equal(totaux.remiseMontant, 25000)
    assert.equal(totaux.totalHt, 225000)
    assert.equal(totaux.totalTtc, 225000)
  })

  test('recalculates AIRSI on TTC after global remise (alignement FNE)', ({ assert }) => {
    const ligne: CalculatedLigne = {
      ...sampleLigne(),
      designation: 'TOMATE',
      quantite: 1,
      prixUnitaire: 30000,
      remisePct: 0,
      tvaPct: 18,
      montantHt: 25424,
      montantTva: 4576,
      montantTtc: 30000,
      airsiPct: 5,
      airsiMontant: 1500,
      montantApresAirsi: 31500,
    }

    const totaux = calculerTotauxVente([ligne], 5)

    assert.equal(totaux.remiseMontant, 1271.2)
    assert.equal(totaux.totalHt, 24152.8)
    assert.equal(totaux.totalTtc, 28500.3)
    assert.equal(totaux.airsiMontant, 1425.02)
    assert.equal(totaux.totalApresAirsi, 29925.32)
    assert.equal(ligne.airsiMontant, 1425.02)
    assert.equal(ligne.montantApresAirsi, 29925.32)
    assert.notEqual(totaux.airsiMontant, 1500)
    assert.notEqual(totaux.totalApresAirsi, 31500)
  })

  test('retour full line uses facture global remise for totaux (alignement FNE)', ({ assert }) => {
    const ligne: CalculatedLigne = {
      ...sampleLigne(),
      quantite: 1,
      prixUnitaire: 30000,
      tvaPct: 18,
      montantHt: 25424,
      montantTva: 4576,
      montantTtc: 30000,
      airsiPct: 5,
      airsiMontant: 1500,
      montantApresAirsi: 31500,
    }

    const factureRemisePct = 5
    const totaux = calculerTotauxVente([ligne], factureRemisePct)

    assert.equal(totaux.totalTtc, 28500.3)
    assert.equal(totaux.airsiMontant, 1425.02)
    assert.equal(totaux.totalApresAirsi, 29925.32)
  })
})

test.group('assertVenteCertifiable', () => {
  const baseContext = () => ({
    client: { type: 'B2C', ncc: null } as Client,
    lignes: [{ id: 1 }] as VenteLigne[],
    pointDeVente: { nom: 'PDV', pointOfSale: 'pdv' } as PointDeVente,
  })

  test('rejects non_valide facture', ({ assert }) => {
    const vente = { statut: VENTE_STATUT.NON_VALIDE, excluded: false, normalise: false } as Vente
    const { client, lignes, pointDeVente } = baseContext()

    assert.throws(
      () => assertVenteCertifiable(vente, client, lignes, pointDeVente),
      FneCertificationError,
      /doit être validée/
    )
  })

  test('accepts valide facture', ({ assert }) => {
    const vente = { statut: VENTE_STATUT.VALIDE, excluded: false, normalise: false } as Vente
    const { client, lignes, pointDeVente } = baseContext()

    assert.doesNotThrow(() => assertVenteCertifiable(vente, client, lignes, pointDeVente))
  })
})

test.group('buildFneInvoicePayload', () => {
  test('maps vente data to FNE payload with TVA code from rate', ({ assert }) => {
    const vente = {
      numero: '01-FAC-2026-0001',
      dateVente: DateTime.fromISO('2026-01-15'),
      sousTotal: '1180.00',
      totalTtc: '1180.00',
      totalApresAirsi: '1239.00',
      airsiPct: '5.00',
      airsiMontant: '59.00',
      tvaMontant: '180.00',
      remisePct: '0.00',
      notes: 'Merci',
    } as any

    const client = {
      nom: 'Société ABC',
      email: 'client@ex.com',
      telephone: '+22501020304',
      ncc: '123456789',
      type: 'B2B',
    } as any

    const pointDeVente = {
      nom: 'PDV Principal',
      pointOfSale: 'pdv-principal',
      establishment: 'etablissement-1',
      timbreReference: null,
    } as any

    const lignes = [
      {
        id: 1,
        produitId: 1,
        designation: 'Produit test',
        quantite: '2',
        prixUnitaire: '590.00',
        remisePct: '0',
        tvaPct: '18',
        montantHt: '1000.00',
        montantTtc: '1180.00',
        airsiPct: '5.00',
        airsiMontant: '59.00',
        montantApresAirsi: '1239.00',
      },
    ] as any[]

    const produitsById = new Map<number, Produit>([
      [
        1,
        {
          id: 1,
          code: 'PRD-0001',
        } as Produit,
      ],
    ])

    const payload = buildFneInvoicePayload({
      vente,
      client,
      pointDeVente,
      lignes,
      produitsById,
      paymentMethod: 'deferred',
    })

    assert.equal(payload.amount, 1239)
    assert.equal(payload.template, 'B2B')
    assert.equal(payload.clientNcc, '123456789')
    assert.equal(payload.items[0].taxes[0], 'TVA')
    assert.equal(payload.items[0].amount, 500)
    assert.deepEqual(payload.items[0].customTaxes, [{ name: 'AIRSI', amount: 5 }])
    assert.equal(payload.commercialMessage, 'ref: 01-FAC-2026-0001 Merci')
  })

  test('sends gross unit HT and line discount separately for FNE', ({ assert }) => {
    const vente = {
      numero: '01-FAC-2026-0004',
      dateVente: DateTime.fromISO('2026-01-15'),
      sousTotal: '21240.00',
      totalTtc: '21240.00',
      totalApresAirsi: '21240.00',
      airsiPct: '0.00',
      airsiMontant: '0.00',
      tvaMontant: '3240.00',
      remisePct: '0.00',
      notes: null,
    } as any

    const payload = buildFneInvoicePayload({
      vente,
      client: { nom: 'Client', type: 'B2C' } as any,
      pointDeVente: { nom: 'PDV', pointOfSale: 'pdv', establishment: 'etab' } as any,
      lignes: [
        {
          id: 1,
          produitId: 1,
          designation: 'Produit',
          quantite: '1',
          prixUnitaire: '23600.00',
          remisePct: '10',
          tvaPct: '18',
          montantHt: '18000.00',
          montantTtc: '21240.00',
          airsiPct: '0.00',
          airsiMontant: '0.00',
          montantApresAirsi: '21240.00',
        },
      ] as any[],
      produitsById: new Map([[1, { id: 1, code: 'PRD-1' } as Produit]]),
      paymentMethod: 'cash',
    })

    assert.equal(payload.items[0].amount, 20000)
    assert.equal(payload.items[0].discount, 10)
  })

  test('sends AIRSI rate in customTaxes amount, not the FCFA montant', ({ assert }) => {
    const vente = {
      numero: '01-FAC-2026-0003',
      dateVente: DateTime.fromISO('2026-01-15'),
      sousTotal: '30000.00',
      totalTtc: '30000.00',
      totalApresAirsi: '31500.00',
      airsiPct: '5.00',
      airsiMontant: '1500.00',
      tvaMontant: '4580.00',
      remisePct: '0.00',
      notes: null,
    } as any

    const payload = buildFneInvoicePayload({
      vente,
      client: { nom: 'Client', type: 'B2C' } as any,
      pointDeVente: { nom: 'PDV', pointOfSale: 'pdv', establishment: 'etab' } as any,
      lignes: [
        {
          id: 1,
          produitId: 1,
          designation: 'Produit',
          quantite: '1',
          prixUnitaire: '30000.00',
          remisePct: '0',
          tvaPct: '18',
          montantHt: '25423.73',
          montantTtc: '30000.00',
          airsiPct: '5.00',
          airsiMontant: '1500.00',
          montantApresAirsi: '31500.00',
        },
      ] as any[],
      produitsById: new Map([[1, { id: 1, code: 'PRD-1' } as Produit]]),
      paymentMethod: 'cash',
    })

    assert.deepEqual(payload.items[0].customTaxes, [{ name: 'AIRSI', amount: 5 }])
    assert.notEqual(payload.items[0].customTaxes[0].amount, 1500)
    assert.equal(payload.amount, 31500)
  })

  test('omits AIRSI customTaxes when rate is zero', ({ assert }) => {
    const vente = {
      numero: '01-FAC-2026-0002',
      dateVente: DateTime.fromISO('2026-01-15'),
      sousTotal: '1180.00',
      totalTtc: '1180.00',
      totalApresAirsi: '1180.00',
      airsiPct: '0.00',
      airsiMontant: '0.00',
      tvaMontant: '180.00',
      remisePct: '0.00',
      notes: null,
    } as any

    const payload = buildFneInvoicePayload({
      vente,
      client: { nom: 'Client', type: 'B2C' } as any,
      pointDeVente: { nom: 'PDV', pointOfSale: 'pdv', establishment: 'etab' } as any,
      lignes: [
        {
          id: 1,
          produitId: 1,
          designation: 'Produit',
          quantite: '1',
          prixUnitaire: '1180.00',
          remisePct: '0',
          tvaPct: '18',
          montantHt: '1000.00',
          montantTtc: '1180.00',
          airsiPct: '0.00',
          airsiMontant: '0.00',
          montantApresAirsi: '1180.00',
        },
      ] as any[],
      produitsById: new Map([[1, { id: 1, code: 'PRD-1' } as Produit]]),
      paymentMethod: 'cash',
    })

    assert.equal(payload.amount, 1180)
    assert.deepEqual(payload.items[0].customTaxes, [])
  })
})

test.group('buildFneRefundItems', () => {
  test('maps retour lines to FNE refund items via ligne_origine_id', ({ assert }) => {
    const lignesOrigineById = new Map<number, VenteLigne>([
      [
        10,
        {
          id: 10,
          designation: 'Produit A',
          fneItemId: 'fne-item-uuid-1',
        } as VenteLigne,
      ],
      [
        11,
        {
          id: 11,
          designation: 'Produit B',
          fneItemId: 'fne-item-uuid-2',
        } as VenteLigne,
      ],
    ])

    const lignesRetour = [
      { id: 1, ligneOrigineId: 10, quantite: '1' },
      { id: 2, ligneOrigineId: 11, quantite: '3' },
    ] as VenteLigne[]

    const items = buildFneRefundItems(lignesRetour, lignesOrigineById, '01-FAC-2026-0001')

    assert.deepEqual(items, [
      { id: 'fne-item-uuid-1', quantity: 1 },
      { id: 'fne-item-uuid-2', quantity: 3 },
    ])
  })

  test('rejects retour line without FNE item on origin', ({ assert }) => {
    const lignesOrigineById = new Map<number, VenteLigne>([
      [
        10,
        {
          id: 10,
          designation: 'Produit A',
          fneItemId: null,
        } as VenteLigne,
      ],
    ])

    assert.throws(
      () =>
        buildFneRefundItems(
          [{ id: 1, ligneOrigineId: 10, quantite: '1' } as VenteLigne],
          lignesOrigineById,
          '01-FAC-2026-0001'
        ),
      /n'a pas d'identifiant FNE/
    )
  })

  test('wraps refund items in FNE payload envelope', ({ assert }) => {
    const items = [
      { id: 'fne-item-uuid-1', quantity: 1 },
      { id: 'fne-item-uuid-2', quantity: 3 },
    ]

    assert.deepEqual(buildFneRefundPayload(items), {
      items,
    })
  })
})
