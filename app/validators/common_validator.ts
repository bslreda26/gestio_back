import vine from '@vinejs/vine'

export const USER_ROLES = ['admin', 'gerant', 'caissier', 'facturation'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  gerant: 'Gérant',
  caissier: 'Caissier',
  facturation: 'Facturation',
}

export const idSchema = vine.object({
  id: vine.number().positive(),
})

export const paginationSchema = vine.object({
  page: vine.number().min(1).optional(),
  limit: vine.number().min(1).max(100).optional(),
})

export const dateRangeSchema = vine.object({
  date_from: vine.date({ formats: ['iso8601'] }).optional(),
  date_to: vine.date({ formats: ['iso8601'] }).optional(),
})

export const searchTextSchema = vine.object({
  search: vine.string().trim().minLength(1).maxLength(200).optional(),
})

export const idWithPaginationSchema = vine.compile(
  vine.object({
    id: vine.number().positive(),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
  })
)

export const searchWithPaginationSchema = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    search: vine.string().trim().minLength(1).maxLength(200).optional(),
  })
)
