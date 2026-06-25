import {
  calcChiffreAffairesFromVentes,
  calcVenteMontantChiffreAffaires,
} from '#services/rapport_service'
import { test } from '@japa/runner'

test.group('rapport chiffre affaires', () => {
  test('uses total_apres_airsi per vente', ({ assert }) => {
    assert.equal(calcVenteMontantChiffreAffaires(118_500), 118_500)
  })

  test('subtracts retours from factures', ({ assert }) => {
    const total = calcChiffreAffairesFromVentes([
      { statut: 'valide', totalApresAirsi: 118_500 },
      { statut: 'retour', totalApresAirsi: 12_500 },
    ])

    assert.equal(total, 106_000)
  })
})
