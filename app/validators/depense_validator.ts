import vine from '@vinejs/vine'

export const depenseSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    categorie: vine.string().trim().optional(),
    date_from: vine.date({ formats: ['iso8601'] }).optional(),
    date_to: vine.date({ formats: ['iso8601'] }).optional(),
    caisse_id: vine.number().positive().optional(),
    search: vine.string().trim().optional(),
  })
)

export const depenseIdValidator = vine.compile(vine.object({ id: vine.number().positive() }))

export const depenseCreateValidator = vine.compile(
  vine.object({
    libelle: vine.string().trim().minLength(1).maxLength(255),
    categorie: vine.string().trim().minLength(1).maxLength(30),
    montant: vine.number().positive(),
    date_depense: vine.date({ formats: ['iso8601'] }),
    caisse_id: vine.number().positive().optional(),
    notes: vine.string().trim().optional(),
  })
)

export const depenseUpdateValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    libelle: vine.string().trim().minLength(1).maxLength(255).optional(),
    categorie: vine.string().trim().minLength(1).maxLength(30).optional(),
    montant: vine.number().positive().optional(),
    date_depense: vine.date({ formats: ['iso8601'] }).optional(),
    notes: vine.string().trim().optional(),
  })
)
