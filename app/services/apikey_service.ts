import Apikey from '#models/apikey'

export async function getActiveApiKey() {
  return Apikey.query().where('is_active', true).orderBy('id', 'desc').first()
}

export async function upsertActiveApiKey(data: {
  key: string
  prod_url: string
  is_active?: boolean
}) {
  await Apikey.query().where('is_active', true).update({ isActive: false })

  return Apikey.create({
    key: data.key,
    prodUrl: data.prod_url,
    isActive: data.is_active ?? true,
  })
}

function maskKey(key: string): string {
  if (key.length <= 8) return '********'
  return `${key.slice(0, 4)}...${key.slice(-4)}`
}

export function serializeApiKey(apikey: Apikey) {
  return {
    id: apikey.id,
    key_preview: maskKey(apikey.key),
    prod_url: apikey.prodUrl,
    is_active: apikey.isActive,
    created_at: apikey.createdAt,
    updated_at: apikey.updatedAt,
  }
}
