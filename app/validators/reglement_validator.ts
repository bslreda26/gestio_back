import vine from '@vinejs/vine'

export const MODES_PAIEMENT = [
  'especes',
  'cheque',
  'virement',
  'mobile_money',
  'carte',
] as const

// Montant non nul : positif = encaissement, négatif = remboursement / annulation
const reglementFields = {
  montant: vine.number(),
  mode_paiement: vine.enum(MODES_PAIEMENT),
  date_reglement: vine.date({ formats: ['iso8601'] }),
  reference_externe: vine.string().trim().maxLength(100).optional(),
  notes: vine.string().trim().optional(),
}

export const reglementClientCreateValidator = vine.compile(
  vine.object({
    client_id: vine.number().positive(),
    ...reglementFields,
  })
)

export const reglementFournisseurCreateValidator = vine.compile(
  vine.object({
    fournisseur_id: vine.number().positive(),
    ...reglementFields,
  })
)

export const reglementClientSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    client_id: vine.number().positive().optional(),
    date_from: vine.date({ formats: ['iso8601'] }).optional(),
    date_to: vine.date({ formats: ['iso8601'] }).optional(),
  })
)

export const reglementFournisseurSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    fournisseur_id: vine.number().positive().optional(),
    date_from: vine.date({ formats: ['iso8601'] }).optional(),
    date_to: vine.date({ formats: ['iso8601'] }).optional(),
  })
)

export const reglementIdValidator = vine.compile(vine.object({ id: vine.number().positive() }))
