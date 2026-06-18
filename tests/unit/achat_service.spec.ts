import {
  calcLigneMontants,
  calculerTotauxAchat,
  prixHtApresRemiseLigne,
  type CalculatedAchatLigne,
} from '#services/achat_service'
import { calcCmupHt } from '#services/pricing_service'
import { test } from '@japa/runner'

test.group('achat calcLigneMontants remise ligne', () => {
  test('applies remise on HT then computes TVA and TTC', ({ assert }) => {
    const { montantHt, montantTva, montantTtc } = calcLigneMontants(10, 25_500, 18, 10)

    assert.equal(montantHt, 229_500)
    assert.equal(montantTva, 41_310)
    assert.equal(montantTtc, 270_810)
  })
})

test.group('achat calculerTotauxAchat remise facture', () => {
  test('applies facture remise montant after line totals', ({ assert }) => {
    const ligne: CalculatedAchatLigne = {
      produitId: 1,
      designation: 'Riz',
      modeAchat: 'piece',
      quantite: 10,
      quantiteStock: 10,
      prixUnitaireHt: 25_500,
      frais: 50,
      remisePct: 10,
      tvaPct: 18,
      ...calcLigneMontants(10, 25_500, 18, 10),
    }

    const totaux = calculerTotauxAchat([ligne], 5_000)

    assert.equal(totaux.sousTotal, 270_810)
    assert.equal(totaux.remiseMontant, 5_000)
    assert.equal(totaux.totalTtc, 265_810)
  })
})

test.group('achat CMUP après remise ligne', () => {
  test('prixHtApresRemiseLigne reduces unit HT before CMUP', ({ assert }) => {
    const prixHt = prixHtApresRemiseLigne(25_500, 10)
    const cmup = calcCmupHt(prixHt, 50, 18)

    assert.equal(prixHt, 22_950)
    assert.equal(cmup, 22_991)
  })
})
