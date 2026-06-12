import { test } from '@japa/runner'
import {
  calcHt,
  calcMargeLigne,
  calcPlancher,
  calcProduitPricing,
  calcCmup,
  calcProduitPricingFromVenteTtc,
  calcTtc,
  roundMoney,
  updateProduitFromAchatReception,
  validatePrixPlancher,
  PlancherValidationError,
} from '#services/pricing_service'

test.group('pricing_service', () => {
  test('calcTtc applies TVA rate', ({ assert }) => {
    assert.equal(calcTtc(10000, 18), 11800)
    assert.equal(calcTtc(10000, 0), 10000)
  })

  test('calcHt reverses TVA from TTC', ({ assert }) => {
    assert.equal(calcHt(11800, 18), 10000)
    assert.equal(calcHt(10000, 0), 10000)
  })

  test('calcPlancher adds frais to prix achat TTC', ({ assert }) => {
    assert.equal(calcPlancher(9440, 500), 9940)
  })

  test('calcMargeLigne is prix vente TTC minus plancher', ({ assert }) => {
    assert.equal(calcMargeLigne(17700, 14660), 3040)
    assert.equal(calcMargeLigne(12000, 14660), -2660)
  })

  test('calcProduitPricing matches project example', ({ assert }) => {
    const result = calcProduitPricing({
      prixAchatHt: 8000,
      prixVenteHt: 10000,
      frais: 500,
      tauxTva: 18,
    })

    assert.equal(result.prixVenteTtc, 11800)
    assert.equal(result.prixAchatTtc, 9440)
    assert.equal(result.plancher, 9940)
  })

  test('calcProduitPricingFromVenteTtc matches project example', ({ assert }) => {
    const result = calcProduitPricingFromVenteTtc({
      prixAchatHt: 8000,
      prixVenteTtc: 11800,
      frais: 500,
      tauxTva: 18,
    })

    assert.equal(result.prixVenteHt, 10000)
    assert.equal(result.prixVenteTtc, 11800)
    assert.equal(result.prixAchatTtc, 9440)
    assert.equal(result.plancher, 9940)
  })

  test('validatePrixPlancher rejects price below floor', ({ assert }) => {
    assert.throws(
      () => validatePrixPlancher(12000, 12300, 'Test'),
      PlancherValidationError
    )
  })

  test('roundMoney rounds to 2 decimals', ({ assert }) => {
    assert.equal(roundMoney(10.125), 10.13)
    assert.equal(roundMoney(10.124), 10.12)
  })

  test('calcCmup blends stock value with incoming quantity', ({ assert }) => {
    assert.equal(calcCmup(50, 12000, 10, 13000), 12166.67)
    assert.equal(calcCmup(0, 0, 10, 9500), 9500)
  })

  test('updateProduitFromAchatReception applies CMUP and recalculates plancher', ({ assert }) => {
    const result = updateProduitFromAchatReception({
      stockAvant: 50,
      quantiteRecue: 10,
      prixUnitaireHt: 13000,
      fraisUnitaire: 700,
      ancienPrixAchatHt: 12000,
      ancienFrais: 500,
      tauxTva: 18,
    })

    assert.equal(result.prixAchatHt, 12166.67)
    assert.equal(result.frais, 533.33)
    assert.equal(result.prixAchatTtc, 14356.67)
    assert.equal(result.plancher, 14890)
  })

  test('updateProduitFromAchatReception uses incoming price when stock is empty', ({ assert }) => {
    const result = updateProduitFromAchatReception({
      stockAvant: 0,
      quantiteRecue: 10,
      prixUnitaireHt: 9500,
      fraisUnitaire: 600,
      ancienPrixAchatHt: 0,
      ancienFrais: 0,
      tauxTva: 18,
    })

    assert.equal(result.prixAchatHt, 9500)
    assert.equal(result.prixAchatTtc, 11210)
    assert.equal(result.frais, 600)
    assert.equal(result.plancher, 11810)
  })
})
