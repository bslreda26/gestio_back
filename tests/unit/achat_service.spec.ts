import { test } from '@japa/runner'
import { resolveFraisAchatLigneGros } from '#services/achat_service'

test.group('achat_service — frais ligne', () => {
  test('prefers product frais over last achat frais', ({ assert }) => {
    assert.equal(resolveFraisAchatLigneGros(600, 350), 600)
  })

  test('uses explicit frais when provided', ({ assert }) => {
    assert.equal(resolveFraisAchatLigneGros(600, 350, 200), 200)
  })

  test('falls back to last achat when product has no frais', ({ assert }) => {
    assert.equal(resolveFraisAchatLigneGros(0, 350), 350)
    assert.equal(resolveFraisAchatLigneGros(0, 0), 0)
  })
})
