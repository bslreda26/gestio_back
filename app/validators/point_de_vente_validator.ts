import vine from '@vinejs/vine'

export const pointDeVenteSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    nom: vine.string().trim().optional(),
    code: vine.string().trim().optional(),
    ville: vine.string().trim().optional(),
    is_active: vine.boolean().optional(),
    search: vine.string().trim().minLength(1).maxLength(200).optional(),
  })
)

export const pointDeVenteIdValidator = vine.compile(
  vine.object({ id: vine.number().positive() })
)

export const pointDeVenteCreateValidator = vine.compile(
  vine.object({
    code: vine
      .string()
      .trim()
      .minLength(1)
      .maxLength(10)
      .regex(/^[A-Za-z0-9-]+$/)
      .unique({ table: 'points_de_vente', column: 'code' }),
    nom: vine.string().trim().minLength(1).maxLength(150),
    adresse: vine.string().trim().optional(),
    ville: vine.string().trim().maxLength(100).optional(),
    telephone: vine.string().trim().maxLength(20).optional(),
    point_of_sale: vine.string().trim().maxLength(150).optional(),
    establishment: vine.string().trim().maxLength(150).optional(),
    timbre_reference: vine.string().trim().maxLength(50).nullable().optional(),
  })
)

export const pointDeVenteUpdateValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    code: vine
      .string()
      .trim()
      .minLength(1)
      .maxLength(10)
      .regex(/^[A-Za-z0-9-]+$/)
      .optional(),
    nom: vine.string().trim().minLength(1).maxLength(150).optional(),
    adresse: vine.string().trim().nullable().optional(),
    ville: vine.string().trim().maxLength(100).nullable().optional(),
    telephone: vine.string().trim().maxLength(20).nullable().optional(),
    is_active: vine.boolean().optional(),
    point_of_sale: vine.string().trim().maxLength(150).nullable().optional(),
    establishment: vine.string().trim().maxLength(150).nullable().optional(),
    timbre_reference: vine.string().trim().maxLength(50).nullable().optional(),
  })
)
