import vine from '@vinejs/vine'

export const tvaGroupeIdValidator = vine.compile(vine.object({ id: vine.number().positive() }))

export const tvaGroupeSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    code: vine.string().trim().optional(),
    libelle: vine.string().trim().optional(),
    is_active: vine.boolean().optional(),
    search: vine.string().trim().optional(),
  })
)

export const tvaGroupeCreateValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(10),
    libelle: vine.string().trim().minLength(1).maxLength(50),
    taux: vine.number().min(0).max(100),
  })
)

export const tvaGroupeUpdateValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    code: vine.string().trim().minLength(1).maxLength(10).optional(),
    libelle: vine.string().trim().minLength(1).maxLength(50).optional(),
    taux: vine.number().min(0).max(100).optional(),
    is_active: vine.boolean().optional(),
  })
)
