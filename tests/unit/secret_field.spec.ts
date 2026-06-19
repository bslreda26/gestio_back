import { decryptSecret, encryptSecret } from '#helpers/secret_field'
import { test } from '@japa/runner'

test.group('secret_field', () => {

  test('round-trips encrypted values', ({ assert }) => {
    const plain = 'fne-api-key-secret-value'
    const stored = encryptSecret(plain)

    assert.notEqual(stored, plain)
    assert.isTrue(stored.startsWith('enc:'))
    assert.equal(decryptSecret(stored), plain)
  })

  test('leaves legacy plaintext values unchanged', ({ assert }) => {
    const legacy = 'plain-legacy-api-key'
    assert.equal(decryptSecret(legacy), legacy)
    assert.equal(encryptSecret(legacy).startsWith('enc:'), true)
  })

  test('does not double-encrypt values', ({ assert }) => {
    const stored = encryptSecret('my-key')
    assert.equal(encryptSecret(stored), stored)
  })
})
