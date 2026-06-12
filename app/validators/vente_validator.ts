import { VENTE_CREATE_STATUTS } from '#constants/vente_statuts'
import vine from '@vinejs/vine'

const ligneVenteSchema = vine.object({
  produit_id: vine.number().positive(),
  quantite: vine.number().positive(),
  mode_vente: vine.enum(['piece', 'detail'] as const).optional(),
  prix_unitaire: vine.number().min(0).optional(),
  remise_pct: vine.number().min(0).max(100).optional(),
})

export const venteLigneInfoValidator = vine.compile(
  vine.object({
    produit_id: vine.number().positive(),
    quantite: vine.number().positive().optional(),
    mode_vente: vine.enum(['piece', 'detail'] as const).optional(),
    remise_pct: vine.number().min(0).max(100).optional(),
  })
)

const modePaiement = vine.enum([
  'especes',
  'cheque',
  'virement',
  'mobile_money',
  'carte',
] as const)

const venteCriteriaFields = {
  page: vine.number().min(1).optional(),
  limit: vine.number().min(1).max(100).optional(),
  type: vine.enum(['vente', 'retour'] as const).optional(),
  statut: vine.string().trim().optional(),
  statut_paiement: vine.string().trim().optional(),
  client_id: vine.number().positive().optional(),
  user_id: vine.number().positive().optional(),
  numero: vine.string().trim().optional(),
  search: vine.string().trim().optional(),
}

export const venteSearchValidator = vine.compile(
  vine.object({
    ...venteCriteriaFields,
    date_from: vine.date({ formats: ['iso8601'] }).optional(),
    date_to: vine.date({ formats: ['iso8601'] }).optional(),
  })
)

export const venteGetByCriteriaValidator = vine.compile(
  vine.object({
    ...venteCriteriaFields,
    date_from: vine.date({ formats: ['iso8601'] }),
    date_to: vine.date({ formats: ['iso8601'] }),
  })
)

export const venteIdValidator = vine.compile(vine.object({ id: vine.number().positive() }))

export const venteCreateValidator = vine.compile(
  vine.object({
    statut: vine.enum(VENTE_CREATE_STATUTS),
    client_id: vine.number().positive(),
    date_vente: vine.date({ formats: ['iso8601'] }),
    date_echeance: vine.date({ formats: ['iso8601'] }).optional(),
    remise_pct: vine.number().min(0).max(100).optional(),
    remise_montant: vine.number().min(0).optional(),
    notes: vine.string().trim().optional(),
    lignes: vine.array(ligneVenteSchema).minLength(1),
  })
)

export const venteUpdateValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    client_id: vine.number().positive().optional(),
    date_vente: vine.date({ formats: ['iso8601'] }).optional(),
    date_echeance: vine.date({ formats: ['iso8601'] }).nullable().optional(),
    remise_pct: vine.number().min(0).max(100).optional(),
    remise_montant: vine.number().min(0).optional(),
    notes: vine.string().trim().optional(),
    lignes: vine.array(ligneVenteSchema).minLength(1).optional(),
  })
)

export const venteAnnulerValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    notes: vine.string().trim().optional(),
  })
)

export const venteRetourValidator = vine.compile(
  vine.object({
    facture_id: vine.number().positive(),
    notes: vine.string().trim().optional(),
    lignes: vine
      .array(
        vine.object({
          ligne_id: vine.number().positive(),
          quantite: vine.number().positive(),
        })
      )
      .minLength(1),
  })
)

export const ventePaiementValidator = vine.compile(
  vine.object({
    vente_id: vine.number().positive(),
    montant: vine.number().positive(),
    mode_paiement: modePaiement,
    date_paiement: vine.date({ formats: ['iso8601'] }),
    reference_paiement: vine.string().trim().optional(),
    notes: vine.string().trim().optional(),
  })
)

export const ventePaiementsSearchValidator = vine.compile(
  vine.object({
    vente_id: vine.number().positive(),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
  })
)

export const venteUnlockValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    force: vine.boolean().optional(),
  })
)
