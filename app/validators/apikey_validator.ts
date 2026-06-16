import vine from '@vinejs/vine'

export const apikeyUpsertValidator = vine.compile(
  vine.object({
    key: vine.string().trim().minLength(1),
    prod_url: vine.string().trim().url(),
    is_active: vine.boolean().optional(),
  })
)
