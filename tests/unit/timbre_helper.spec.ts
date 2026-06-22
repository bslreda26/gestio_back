import {
  computeMontantTimbreFromTotalTtc,
  resolveMontantTimbre,
  venteTotalAPayer,
} from '#helpers/timbre'
import { test } from '@japa/runner'

test.group('computeMontantTimbreFromTotalTtc', () => {
  test('no timbre up to 5000 TTC', ({ assert }) => {
    assert.equal(computeMontantTimbreFromTotalTtc(0), 0)
    assert.equal(computeMontantTimbreFromTotalTtc(5000), 0)
  })

  test('applies bracket amounts', ({ assert }) => {
    assert.equal(computeMontantTimbreFromTotalTtc(5001), 100)
    assert.equal(computeMontantTimbreFromTotalTtc(100_000), 100)
    assert.equal(computeMontantTimbreFromTotalTtc(100_001), 500)
    assert.equal(computeMontantTimbreFromTotalTtc(500_000), 500)
    assert.equal(computeMontantTimbreFromTotalTtc(500_001), 1000)
    assert.equal(computeMontantTimbreFromTotalTtc(1_000_000), 1000)
    assert.equal(computeMontantTimbreFromTotalTtc(1_000_001), 2000)
    assert.equal(computeMontantTimbreFromTotalTtc(5_000_000), 2000)
    assert.equal(computeMontantTimbreFromTotalTtc(5_000_001), 5000)
    assert.equal(computeMontantTimbreFromTotalTtc(10_000_000), 5000)
  })
})

test.group('resolveMontantTimbre', () => {
  test('cash applies brackets', ({ assert }) => {
    assert.equal(resolveMontantTimbre('cash', 20_000), 100)
  })

  test('deferred has no timbre', ({ assert }) => {
    assert.equal(resolveMontantTimbre('deferred', 20_000), 0)
    assert.equal(resolveMontantTimbre(null, 20_000), 0)
  })
})

test.group('venteTotalAPayer', () => {
  test('adds timbre to total apres airsi', ({ assert }) => {
    assert.equal(venteTotalAPayer({ totalApresAirsi: 15_000, montantTimbre: 100 }), 15_100)
  })
})
