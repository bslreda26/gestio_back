import { readFournisseurSoldePdv } from '#services/fournisseur_solde_service'
import { test } from '@japa/runner'

test.group('readFournisseurSoldePdv', () => {
  test('rounds stored decimal solde', ({ assert }) => {
    assert.equal(readFournisseurSoldePdv({ solde: '2500.125' }), 2500.13)
    assert.equal(readFournisseurSoldePdv(null), 0)
  })
})
