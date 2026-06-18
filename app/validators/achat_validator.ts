import vine from '@vinejs/vine'

const ligneAchatSchema = vine.object({
  produit_id: vine.number().positive(),
  quantite: vine.number().positive(),
  prix_unitaire_ht: vine.number().min(0).optional(),
  frais: vine.number().min(0).optional(),
  remise_pct: vine.number().min(0).max(100).optional(),
})

const ligneRecueSchema = vine.object({
  ligne_id: vine.number().positive(),
  quantite_recue: vine.number().positive(),
})

const modePaiement = vine.enum([
  'especes',
  'cheque',
  'virement',
  'mobile_money',
  'carte',
] as const)

const achatCriteriaFields = {
  page: vine.number().min(1).optional(),
  limit: vine.number().min(1).max(100).optional(),
  type: vine.enum(['achat', 'retour'] as const).optional(),
  statut: vine.string().trim().optional(),
  statut_paiement: vine.string().trim().optional(),
  fournisseur_id: vine.number().positive().optional(),
  numero: vine.string().trim().optional(),
  search: vine.string().trim().optional(),
}

export const achatSearchValidator = vine.compile(
  vine.object({
    ...achatCriteriaFields,
    date_from: vine.date({ formats: ['iso8601'] }).optional(),
    date_to: vine.date({ formats: ['iso8601'] }).optional(),
  })
)

export const achatGetByCriteriaValidator = vine.compile(
  vine.object({
    ...achatCriteriaFields,
    date_from: vine.date({ formats: ['iso8601'] }),
    date_to: vine.date({ formats: ['iso8601'] }),
  })
)

export const achatIdValidator = vine.compile(vine.object({ id: vine.number().positive() }))

export const achatLigneInfoValidator = vine.compile(
  vine.object({
    produit_id: vine.number().positive(),
    quantite: vine.number().positive().optional(),
    prix_unitaire_ht: vine.number().min(0).optional(),
    frais: vine.number().min(0).optional(),
    remise_pct: vine.number().min(0).max(100).optional(),
  })
)

export const achatCreateValidator = vine.compile(
  vine.object({
    fournisseur_id: vine.number().positive(),
    date_achat: vine.date({ formats: ['iso8601'] }),
    reference_fournisseur: vine.string().trim().optional(),
    remise_montant: vine.number().min(0).optional(),
    notes: vine.string().trim().optional(),
    lignes: vine.array(ligneAchatSchema).minLength(1),
  })
)

export const achatUpdateValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    fournisseur_id: vine.number().positive().optional(),
    date_achat: vine.date({ formats: ['iso8601'] }).optional(),
    reference_fournisseur: vine.string().trim().nullable().optional(),
    remise_montant: vine.number().min(0).optional(),
    notes: vine.string().trim().optional(),
    lignes: vine.array(ligneAchatSchema).minLength(1).optional(),
  })
)

export const achatAnnulerValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    notes: vine.string().trim().optional(),
  })
)

export const achatRecevoirValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    date_reception: vine.date({ formats: ['iso8601'] }).optional(),
    depot_id: vine.number().positive().optional(),
    lignes: vine.array(ligneRecueSchema).minLength(1),
  })
)

export const achatRetourValidator = vine.compile(
  vine.object({
    achat_id: vine.number().positive(),
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

export const achatPaiementValidator = vine.compile(
  vine.object({
    achat_id: vine.number().positive(),
    montant: vine.number().positive(),
    mode_paiement: modePaiement,
    date_paiement: vine.date({ formats: ['iso8601'] }),
    reference_paiement: vine.string().trim().optional(),
    notes: vine.string().trim().optional(),
  })
)
