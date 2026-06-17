import {
  isFneCertificationSuccessful,
  parseFneApiResponse,
} from '#helpers/fne_response_parser'
import { test } from '@japa/runner'

test.group('parseFneApiResponse', () => {
  test('extracts token, reference and invoice id from nested payload', ({ assert }) => {
    const parsed = parseFneApiResponse(
      JSON.stringify({
        statusCode: 200,
        reference: '9606123E25000000019',
        token: 'https://fne.dgi.gouv.ci/verify/abc123',
        invoice: {
          id: 'uuid-fne-1',
          items: [{ id: 'line-1', reference: 'PRD-0001' }],
        },
      })
    )

    assert.isNotNull(parsed)
    assert.equal(parsed!.reference, '9606123E25000000019')
    assert.equal(parsed!.token, 'https://fne.dgi.gouv.ci/verify/abc123')
    assert.equal(parsed!.invoiceId, 'uuid-fne-1')
    assert.equal(parsed!.qrContent, 'https://fne.dgi.gouv.ci/verify/abc123')
  })

  test('returns null for invalid json', ({ assert }) => {
    assert.isNull(parseFneApiResponse('not-json'))
  })

  test('parses refund success without invoice object', ({ assert }) => {
    const parsed = parseFneApiResponse(
      JSON.stringify({
        ncc: '9606123E',
        reference: 'A9606123E2500000006',
        token: 'https://fne.dgi.gouv.ci/verify/refund-1',
      })
    )

    assert.isNotNull(parsed)
    assert.equal(parsed!.invoiceId, 'A9606123E2500000006')
    assert.equal(parsed!.reference, 'A9606123E2500000006')
    assert.isTrue(
      isFneCertificationSuccessful({
        reference: 'A9606123E2500000006',
        token: 'https://fne.dgi.gouv.ci/verify/refund-1',
      })
    )
  })

  test('rejects refund bad request responses', ({ assert }) => {
    assert.isFalse(
      isFneCertificationSuccessful({
        message: 'Bad Request Exception',
        statusCode: 400,
      })
    )
  })
})
