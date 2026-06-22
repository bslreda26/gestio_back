import { isTimbreProduitCode } from '#helpers/timbre'
import { test } from '@japa/runner'

test.group('isTimbreProduitCode', () => {
  test('matches product code to PDV timbre reference', ({ assert }) => {
    assert.isTrue(isTimbreProduitCode('TIMBRE-FNE', 'TIMBRE-FNE'))
    assert.isTrue(isTimbreProduitCode('  TIMBRE-FNE  ', 'TIMBRE-FNE'))
  })

  test('rejects mismatch or missing reference', ({ assert }) => {
    assert.isFalse(isTimbreProduitCode('AUTRE', 'TIMBRE-FNE'))
    assert.isFalse(isTimbreProduitCode('TIMBRE-FNE', null))
    assert.isFalse(isTimbreProduitCode('TIMBRE-FNE', ''))
  })
})
