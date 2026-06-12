import vine from '@vinejs/vine'

export const depenseCategorieIdValidator = vine.compile(
  vine.object({ id: vine.number().positive() })
)

export const depenseCategorieSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    code: vine.string().trim().optional(),
    libelle: vine.string().trim().optional(),
    is_active: vine.boolean().optional(),
    search: vine.string().trim().optional(),
  })
)

export const depenseCategorieCreateValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1).maxLength(30),
    libelle: vine.string().trim().minLength(1).maxLength(100),
  })
)

export const depenseCategorieUpdateValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    code: vine.string().trim().minLength(1).maxLength(30).optional(),
    libelle: vine.string().trim().minLength(1).maxLength(100).optional(),
    is_active: vine.boolean().optional(),
  })
)
