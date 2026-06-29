import { clientVenteMontantCompte } from '#services/rapport_service'
import { test } from '@japa/runner'

test.group('clientVenteMontantCompte', () => {
  test('includes timbre fiscal on top of total apres airsi', ({ assert }) => {
    assert.equal(
      clientVenteMontantCompte({ totalApresAirsi: 172_000, montantTimbre: 500 }),
      172_500
    )
  })

  test('matches vente total a payer without timbre', ({ assert }) => {
    assert.equal(clientVenteMontantCompte({ totalApresAirsi: 50_000, montantTimbre: 0 }), 50_000)
  })
})
