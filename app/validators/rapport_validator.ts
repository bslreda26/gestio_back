import vine from '@vinejs/vine'

const stockAlertValues = ['rupture', 'alerte', 'normal', 'surstock'] as const

export const rapportCaisseValidator = vine.compile(
  vine.object({
    date_from: vine.date({ formats: ['iso8601'] }),
    date_to: vine.date({ formats: ['iso8601'] }),
    caisse_id: vine.number().positive().optional(),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
  })
)

export const rapportStockActuelValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    categorie_id: vine.number().positive().optional(),
    stock_alert: vine.enum(stockAlertValues).optional(),
    search: vine.string().trim().optional(),
    is_active: vine.boolean().optional(),
  })
)

export const rapportValeurStockValidator = vine.compile(
  vine.object({
    categorie_id: vine.number().positive().optional(),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
  })
)

export const rapportBalanceClientsValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    client_id: vine.number().positive().optional(),
    search: vine.string().trim().optional(),
  })
)

export const rapportReleveClientValidator = vine.compile(
  vine.object({
    client_id: vine.number().positive(),
    date_from: vine.date({ formats: ['iso8601'] }),
    date_to: vine.date({ formats: ['iso8601'] }),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
  })
)
