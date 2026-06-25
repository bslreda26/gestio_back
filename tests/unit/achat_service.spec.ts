import {
  calcLigneMontants,
  calcOwedTtcFromReceivedLines,
  calcPrixHtCmupAchatLigne,
  calcRemiseFactureHtParLigne,
  calculerTotauxAchat,
  prixHtApresRemiseLigne,
  type CalculatedAchatLigne,
} from '#services/achat_service'
import { calcCmup, calcCmupHt, reverseCmup } from '#services/pricing_service'
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
    assert.equal(cmup, 22_992.37)
  })
})

test.group('achat CMUP après remise facture', () => {
  test('distributes remise montant on HT and lowers unit CMUP', ({ assert }) => {
    const lignes = [{ montantHt: 1_080_000 }, { montantHt: 0 }]
    const remiseParts = calcRemiseFactureHtParLigne(lignes, 30_000)

    assert.equal(remiseParts[0], 30_000)
    assert.equal(remiseParts[1], 0)

    const prixHtCmup = calcPrixHtCmupAchatLigne(
      { montantHt: 1_080_000, quantite: 100 },
      remiseParts[0],
      100
    )
    assert.equal(prixHtCmup, 10_500)
  })
})

test.group('achat owed TTC with facture remise', () => {
  test('applies proportional HT remise on partial reception', ({ assert }) => {
    const owed = calcOwedTtcFromReceivedLines(
      [
        {
          quantite: 10,
          quantiteRecue: 5,
          montantHt: 100_000,
          montantTva: 18_000,
        },
      ],
      10_000
    )
    assert.equal(owed, 54_000)
  })

  test('matches totalTtc when fully received', ({ assert }) => {
    const ligne: CalculatedAchatLigne = {
      produitId: 1,
      designation: 'Riz',
      modeAchat: 'piece',
      quantite: 10,
      quantiteStock: 10,
      prixUnitaireHt: 10_000,
      frais: 0,
      remisePct: 0,
      tvaPct: 18,
      ...calcLigneMontants(10, 10_000, 18, 0),
    }
    const totaux = calculerTotauxAchat([ligne], 5_000)
    const owed = calcOwedTtcFromReceivedLines(
      [{ ...ligne, quantiteRecue: 10 }],
      totaux.remiseMontant
    )

    assert.equal(owed, totaux.totalTtc)
  })
})

test.group('achat CMUP reversal', () => {
  test('reverseCmup inverts weighted average', ({ assert }) => {
    const avant = 100
    const valeurAvant = 20
    const qty = 50
    const valeurRecue = 30
    const apres = calcCmup(avant, valeurAvant, qty, valeurRecue)
    const restored = reverseCmup(avant, apres, qty, valeurRecue)

    assert.closeTo(restored, valeurAvant, 0.02)
  })
})
