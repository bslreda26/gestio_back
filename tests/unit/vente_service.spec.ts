import {
  assertProduitsUniquesSurFacture,
  calcLigneMontants,
  calculerTotauxVente,
  VenteBusinessError,
  type CalculatedLigne,
} from '#services/vente_service'
import { test } from '@japa/runner'

test.group('assertProduitsUniquesSurFacture', () => {
  test('accepts distinct products', ({ assert }) => {
    assert.doesNotThrow(() =>
      assertProduitsUniquesSurFacture([
        { produit_id: 1, quantite: 1 },
        { produit_id: 2, quantite: 1 },
      ])
    )
  })

  test('rejects duplicate product on facture', ({ assert }) => {
    assert.throws(
      () =>
        assertProduitsUniquesSurFacture([
          { produit_id: 1, quantite: 1 },
          { produit_id: 1, quantite: 2 },
        ]),
      VenteBusinessError,
      /même article/
    )
  })
})

test.group('calcLigneMontants remise ligne', () => {
  test('applies remise on HT then computes TVA and TTC', ({ assert }) => {
    const prixHt = 20000
    const tvaPct = 18
    const prixTtc = prixHt * (1 + tvaPct / 100)

    const { montantHt, montantTva, montantTtc } = calcLigneMontants(1, prixTtc, tvaPct, 10)

    assert.equal(montantHt, 18000)
    assert.equal(montantTva, 3240)
    assert.equal(montantTtc, 21240)
  })

  test('scales remise on total line HT for quantity > 1', ({ assert }) => {
    const prixHt = 20000
    const tvaPct = 18
    const prixTtc = prixHt * (1 + tvaPct / 100)

    const { montantHt, montantTva, montantTtc } = calcLigneMontants(2, prixTtc, tvaPct, 10)

    assert.equal(montantHt, 36000)
    assert.equal(montantTva, 6480)
    assert.equal(montantTtc, 42480)
  })
})

test.group('calculerTotauxVente remise ligne + remise facture', () => {
  test('applies facture remise on HT after line remise then recalculates TVA', ({ assert }) => {
    const prixHt = 20000
    const tvaPct = 18
    const prixTtc = prixHt * (1 + tvaPct / 100)
    const ligneMontants = calcLigneMontants(1, prixTtc, tvaPct, 10)

    const ligne: CalculatedLigne = {
      produitId: 1,
      designation: 'Article',
      modeVente: 'piece',
      quantite: 1,
      quantiteStock: 1,
      prixUnitaire: prixTtc,
      plancherLigne: 0,
      marge: 0,
      remisePct: 10,
      tvaPct,
      ...ligneMontants,
      airsiPct: 0,
      airsiMontant: 0,
      montantApresAirsi: ligneMontants.montantTtc,
    }

    const totaux = calculerTotauxVente([ligne], 10)

    assert.equal(ligne.montantHt, 18000)
    assert.equal(totaux.sousTotal, 21240)
    assert.equal(totaux.remiseMontant, 1800)
    assert.equal(totaux.totalHt, 16200)
    assert.equal(totaux.tvaMontant, 2916)
    assert.equal(totaux.totalTtc, 19116)
  })
})
