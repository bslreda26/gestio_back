import { calcAirsi, fneNomTvaFromTaux } from '#constants/fne_tva'
import { test } from '@japa/runner'

test.group('FNE TVA', () => {
  test('maps standard rates to FNE codes', ({ assert }) => {
    assert.equal(fneNomTvaFromTaux(18), 'TVA')
    assert.equal(fneNomTvaFromTaux(9), 'TVAB')
    assert.equal(fneNomTvaFromTaux(0), 'TVAC')
  })

  test('rejects unsupported TVA rates', ({ assert }) => {
    assert.throws(() => fneNomTvaFromTaux(5), /non supporté/)
  })

  test('calculates AIRSI as deduction after total TTC', ({ assert }) => {
    const result = calcAirsi(20_000, 5)
    assert.equal(result.airsiMontant, 1_000)
    assert.equal(result.totalApresAirsi, 19_000)
  })
})
