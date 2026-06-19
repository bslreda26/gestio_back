import { readClientSolde } from '#services/client_solde_service'
import { test } from '@japa/runner'

test.group('readClientSolde', () => {
  test('rounds stored decimal solde', ({ assert }) => {
    assert.equal(readClientSolde({ solde: '1234.567' }), 1234.57)
    assert.equal(readClientSolde({ solde: '0' }), 0)
  })
})
