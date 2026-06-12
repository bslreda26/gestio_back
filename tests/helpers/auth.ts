import type { ApiClient, ApiRequest } from '@japa/api-client'

const ADMIN_EMAIL = 'admin@gestion.com'
const ADMIN_PASSWORD = 'Admin@123456'

/** Default seeded point de vente (code 01) */
export const DEFAULT_POINT_DE_VENTE_ID = 1

export function withPosHeader<T extends ApiRequest>(request: T): T {
  return request.header('X-Point-De-Vente-Id', String(DEFAULT_POINT_DE_VENTE_ID)) as T
}

/** Authenticated API call scoped to the default point de vente */
export function authedPos(client: ApiClient, token: string) {
  return {
    post: (url: string) => withPosHeader(client.post(url).bearerToken(token)),
    get: (url: string) => withPosHeader(client.get(url).bearerToken(token)),
  }
}

type LoginResponse = {
  data: {
    token: string
  }
}

export async function loginAsAdmin(client: ApiClient): Promise<string> {
  const response = await client.post('/api/v1/auth/login').json({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })

  response.assertStatus(200)
  const body = response.body() as LoginResponse
  return body.data.token
}

export async function openCaisse(
  client: ApiClient,
  token: string,
  montant = 0
): Promise<void> {
  const response = await authedPos(client, token).post('/api/v1/caisse/ouverture').json({ montant })
  response.assertStatus(200)
}
