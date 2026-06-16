import { isFneCertificationSuccessful } from '#helpers/fne_response_parser'
import { test } from '@japa/runner'

test.group('isFneCertificationSuccessful', () => {
  test('accepts FNE payload without statusCode when invoice.id is present', ({ assert }) => {
    assert.isTrue(
      isFneCertificationSuccessful({
        ncc: '9606123E',
        reference: '1102324W26000001382',
        token: 'https://fne.dgi.gouv.ci/verify/abc',
        invoice: { id: '8a03883b-0add-42d8-a6e5-824022f097e6', items: [] },
      })
    )
  })

  test('accepts legacy statusCode 200 payload', ({ assert }) => {
    assert.isTrue(
      isFneCertificationSuccessful({
        statusCode: 200,
        invoice: { id: 'uuid-fne-1' },
      })
    )
  })

  test('rejects payload without invoice id', ({ assert }) => {
    assert.isFalse(
      isFneCertificationSuccessful({
        reference: '1102324W26000001382',
        token: 'https://fne.dgi.gouv.ci/verify/abc',
      })
    )
  })

  test('rejects explicit statusCode 500', ({ assert }) => {
    assert.isFalse(
      isFneCertificationSuccessful({
        statusCode: 500,
        invoice: { id: 'uuid-fne-1' },
      })
    )
  })

  test('rejects explicit client error status codes', ({ assert }) => {
    assert.isFalse(
      isFneCertificationSuccessful({
        statusCode: 422,
        message: 'Erreur FNE',
      })
    )
  })
})
