import vine from '@vinejs/vine'
import { MODES_PAIEMENT } from '#validators/reglement_validator'

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
    depot_id: vine.number().positive().optional(),
  })
)

export const rapportValeurStockValidator = vine.compile(
  vine.object({
    categorie_id: vine.number().positive().optional(),
    depot_id: vine.number().positive().optional(),
    par_depot: vine.boolean().optional(),
    search: vine.string().trim().optional(),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
  })
)

export const rapportMouvementsStockValidator = vine.compile(
  vine.object({
    date_debut: vine.date({ formats: ['iso8601'] }),
    date_fin: vine.date({ formats: ['iso8601'] }),
    categorie_id: vine.number().positive().optional(),
    produit_id: vine.number().positive().optional(),
    depot_id: vine.number().positive().optional(),
    search: vine.string().trim().optional(),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
  })
)

export const rapportMargeValidator = vine.compile(
  vine.object({
    date_debut: vine.date({ formats: ['iso8601'] }),
    date_fin: vine.date({ formats: ['iso8601'] }),
    categorie_id: vine.number().positive().optional(),
    produit_id: vine.number().positive().optional(),
    produit_ids: vine.array(vine.number().positive()).minLength(1).optional(),
    search: vine.string().trim().optional(),
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

export const rapportDepensesValidator = vine.compile(
  vine.object({
    date_debut: vine.date({ formats: ['iso8601'] }),
    date_fin: vine.date({ formats: ['iso8601'] }),
  })
)

export const rapportChiffreAffaireValidator = vine.compile(
  vine.object({
    date_debut: vine.date({ formats: ['iso8601'] }).optional(),
    date_fin: vine.date({ formats: ['iso8601'] }).optional(),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    client_id: vine.number().positive().optional(),
    search: vine.string().trim().optional(),
  })
)

export const rapportBalanceFournisseursValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    fournisseur_id: vine.number().positive().optional(),
    search: vine.string().trim().optional(),
  })
)

export const rapportReleveFournisseurValidator = vine.compile(
  vine.object({
    fournisseur_id: vine.number().positive(),
    date_from: vine.date({ formats: ['iso8601'] }),
    date_to: vine.date({ formats: ['iso8601'] }),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
  })
)

export const rapportReglementClientsValidator = vine.compile(
  vine.object({
    date_from: vine.date({ formats: ['iso8601'] }),
    date_to: vine.date({ formats: ['iso8601'] }),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    client_id: vine.number().positive().optional(),
    mode_paiement: vine.enum(MODES_PAIEMENT).optional(),
    search: vine.string().trim().optional(),
  })
)

export const rapportReglementFournisseursValidator = vine.compile(
  vine.object({
    date_from: vine.date({ formats: ['iso8601'] }),
    date_to: vine.date({ formats: ['iso8601'] }),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    fournisseur_id: vine.number().positive().optional(),
    mode_paiement: vine.enum(MODES_PAIEMENT).optional(),
    search: vine.string().trim().optional(),
  })
)

export const rapportCertificationValidator = vine.compile(
  vine.object({
    date_debut: vine.date({ formats: ['iso8601'] }),
    date_fin: vine.date({ formats: ['iso8601'] }),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    normalise: vine.boolean().optional(),
    search: vine.string().trim().optional(),
  })
)
