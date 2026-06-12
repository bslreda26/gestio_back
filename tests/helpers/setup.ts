import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'

/**
 * DB transaction rollback + rate-limiter reset between functional tests.
 */
export async function withIsolatedTest() {
  const dbTeardown = await testUtils.db().wrapInGlobalTransaction()
  return async () => {
    await dbTeardown()
    await limiter.clear(['memory'])
  }
}
