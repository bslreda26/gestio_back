import { certificationMontantsTotaux } from '#services/rapport_service'
import { test } from '@japa/runner'

test.group('rapport certification totaux', () => {
  test('subtracts retours from factures for net total', ({ assert }) => {
    const totaux = certificationMontantsTotaux({
      total_factures_ttc: 1_668_006.09,
      total_retours_ttc: 90_000,
    })

    assert.equal(totaux.total_factures_ttc, 1_668_006.09)
    assert.equal(totaux.total_retours_ttc, 90_000)
    assert.equal(totaux.total_ttc, 1_578_006.09)
  })
})
