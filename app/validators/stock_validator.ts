import vine from '@vinejs/vine'

const stockAlertValues = ['rupture', 'alerte', 'normal', 'surstock'] as const

export const stockSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    categorie_id: vine.number().positive().optional(),
    depot_id: vine.number().positive().optional(),
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
    depot_id: vine.number().positive().optional(),
    type: vine.enum(['entree', 'sortie', 'ajustement', 'transfert'] as const).optional(),
    motif: vine.string().trim().optional(),
    date_debut: vine.date({ formats: ['iso8601'] }).optional(),
    date_fin: vine.date({ formats: ['iso8601'] }).optional(),
    date_from: vine.date({ formats: ['iso8601'] }).optional(),
    date_to: vine.date({ formats: ['iso8601'] }).optional(),
  })
)

export const stockAlertesValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    depot_id: vine.number().positive().optional(),
  })
)

export const stockInventaireValidator = vine.compile(
  vine.object({
    produit_id: vine.number().positive(),
    quantite_comptee: vine.number().min(0),
    notes: vine.string().trim().optional(),
  })
)

export const stockPerteValidator = vine.compile(
  vine.object({
    produit_id: vine.number().positive(),
    quantite: vine.number().positive(),
    notes: vine.string().trim().optional(),
  })
)

const inventaireSaisieLigneSchema = vine.object({
  produit_id: vine.number().positive(),
  entree: vine.number().min(0).optional(),
  sortie: vine.number().min(0).optional(),
  mode_vente_entree: vine.enum(['piece', 'detail'] as const).optional(),
  mode_vente_sortie: vine.enum(['piece', 'detail'] as const).optional(),
})

export const stockInventaireGrilleValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(500).optional(),
    depot_id: vine.number().positive(),
    categorie_id: vine.number().positive().optional(),
    search: vine.string().trim().optional(),
  })
)

export const stockInventaireSaisieValidator = vine.compile(
  vine.object({
    depot_id: vine.number().positive(),
    date_saisie: vine.date({ formats: ['iso8601'] }).optional(),
    notes: vine.string().trim().optional(),
    lignes: vine.array(inventaireSaisieLigneSchema).minLength(1),
  })
)

export const stockInventaireSaisieSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    depot_id: vine.number().positive().optional(),
    date_from: vine.date({ formats: ['iso8601'] }).optional(),
    date_to: vine.date({ formats: ['iso8601'] }).optional(),
  })
)

export const stockInventaireSaisieIdValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
  })
)
