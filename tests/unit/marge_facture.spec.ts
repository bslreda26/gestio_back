import { test } from '@japa/runner'
import { calcMargeTotaleLigne, calculerMargeFacture } from '#services/pricing_service'

test.group('calculerMargeFacture', () => {
  test('sums line margins and applies global remise proportionally', ({ assert }) => {
    const lignes = [
      { marge: 1000, quantite: 2, remisePct: 0 },
      { marge: 500, quantite: 1, remisePct: 10 },
    ]

    const { marge, margePct } = calculerMargeFacture(lignes, 10000, 9000)

    assert.equal(calcMargeTotaleLigne(1000, 2, 0), 2000)
    assert.equal(calcMargeTotaleLigne(500, 1, 10), 450)
    assert.equal(marge, 2205)
    assert.equal(margePct, 24.5)
  })

  test('returns zero when there are no lines', ({ assert }) => {
    const { marge, margePct } = calculerMargeFacture([], 0, 0)
    assert.equal(marge, 0)
    assert.equal(margePct, 0)
  })
})
