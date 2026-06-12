import vine from '@vinejs/vine'

const stockAlertValues = ['rupture', 'alerte', 'normal', 'surstock'] as const

export const stockSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    categorie_id: vine.number().positive().optional(),
    stock_alert: vine.enum(stockAlertValues).optional(),
    search: vine.string().trim().optional(),
    is_active: vine.boolean().optional(),
  })
)

export const stockMouvementsSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    produit_id: vine.number().positive().optional(),
    type: vine.enum(['entree', 'sortie', 'ajustement', 'transfert'] as const).optional(),
    motif: vine.string().trim().optional(),
    date_from: vine.date({ formats: ['iso8601'] }).optional(),
    date_to: vine.date({ formats: ['iso8601'] }).optional(),
  })
)

export const stockAlertesValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
  })
)
