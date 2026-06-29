import vine from '@vinejs/vine'

export const dashboardValidator = vine.compile(
  vine.object({
    date_debut: vine.date({ formats: ['iso8601'] }),
    date_fin: vine.date({ formats: ['iso8601'] }),
    depot_id: vine.number().positive().optional(),
    categorie_id: vine.number().positive().optional(),
    client_id: vine.number().positive().optional(),
  })
)
