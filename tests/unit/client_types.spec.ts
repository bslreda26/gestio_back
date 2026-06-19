import {
  CLIENT_TYPE_LABELS,
  clientTypeRequiresNcc,
  resolveFneTemplate,
} from '#constants/client_types'
import { test } from '@japa/runner'

test.group('client_types', () => {
  test('B2F is export and B2G is government', ({ assert }) => {
    assert.equal(CLIENT_TYPE_LABELS.B2F, 'Export (B2F)')
    assert.equal(CLIENT_TYPE_LABELS.B2G, 'Gouvernement (B2G)')
  })

  test('resolveFneTemplate maps each client type to FNE template', ({ assert }) => {
    assert.equal(resolveFneTemplate('B2B'), 'B2B')
    assert.equal(resolveFneTemplate('B2C'), 'B2C')
    assert.equal(resolveFneTemplate('B2F'), 'B2F')
    assert.equal(resolveFneTemplate('B2G'), 'B2G')
    assert.equal(resolveFneTemplate(null), 'B2C')
  })

  test('NCC required for B2B and B2G only', ({ assert }) => {
    assert.isTrue(clientTypeRequiresNcc('B2B'))
    assert.isTrue(clientTypeRequiresNcc('B2G'))
    assert.isFalse(clientTypeRequiresNcc('B2C'))
    assert.isFalse(clientTypeRequiresNcc('B2F'))
  })
})
