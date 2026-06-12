import vine from '@vinejs/vine'

export const categorieSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    nom: vine.string().trim().optional(),
    point_de_vente_id: vine.number().positive().optional(),
  })
)

export const categorieIdValidator = vine.compile(vine.object({ id: vine.number().positive() }))

export const categorieCreateValidator = vine.compile(
  vine.object({
    nom: vine.string().trim().minLength(1).maxLength(100),
    description: vine.string().trim().optional(),
    point_de_vente_id: vine.number().positive().optional(),
  })
)

export const categorieUpdateValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    nom: vine.string().trim().minLength(1).maxLength(100).optional(),
    description: vine.string().trim().optional(),
  })
)
