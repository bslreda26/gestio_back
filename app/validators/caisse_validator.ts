import vine from '@vinejs/vine'

const caisseMouvementsCriteriaFields = {
  page: vine.number().min(1).optional(),
  limit: vine.number().min(1).max(100).optional(),
  type: vine.enum(['entree', 'sortie'] as const).optional(),
  motif: vine.string().trim().optional(),
  designation: vine.string().trim().minLength(1).maxLength(200).optional(),
  caisse_id: vine.number().positive().optional(),
  caisse_session_id: vine.number().positive().optional(),
}

export const caisseMouvementsSearchValidator = vine.compile(
  vine.object({
    ...caisseMouvementsCriteriaFields,
    date_from: vine.date({ formats: ['iso8601'] }).optional(),
    date_to: vine.date({ formats: ['iso8601'] }).optional(),
  })
)

export const caisseGetByCriteriaValidator = vine.compile(
  vine.object({
    ...caisseMouvementsCriteriaFields,
    date_from: vine.date({ formats: ['iso8601'] }),
    date_to: vine.date({ formats: ['iso8601'] }),
    cible: vine.enum(['mouvements', 'sessions'] as const).optional(),
    statut: vine.enum(['ouverte', 'fermee'] as const).optional(),
  })
)

export const caisseMouvementIdValidator = vine.compile(
  vine.object({ id: vine.number().positive() })
)

export const caisseOuvertureValidator = vine.compile(
  vine.object({
    montant: vine.number().min(0),
    notes: vine.string().trim().optional(),
    caisse_id: vine.number().positive().optional(),
  })
)

export const caisseFermetureValidator = vine.compile(
  vine.object({
    montant: vine.number().min(0),
    notes: vine.string().trim().optional(),
    caisse_id: vine.number().positive().optional(),
  })
)

export const caisseEntreeManuelleValidator = vine.compile(
  vine.object({
    libelle: vine.string().trim().minLength(1).maxLength(255),
    montant: vine.number().positive(),
    caisse_id: vine.number().positive().optional(),
    notes: vine.string().trim().optional(),
  })
)

const caisseSessionsCriteriaFields = {
  page: vine.number().min(1).optional(),
  limit: vine.number().min(1).max(100).optional(),
  statut: vine.enum(['ouverte', 'fermee'] as const).optional(),
  caisse_id: vine.number().positive().optional(),
  user_ouverture_id: vine.number().positive().optional(),
}

export const caisseSessionsSearchValidator = vine.compile(
  vine.object({
    ...caisseSessionsCriteriaFields,
    date_from: vine.date({ formats: ['iso8601'] }).optional(),
    date_to: vine.date({ formats: ['iso8601'] }).optional(),
  })
)

export const caisseSessionsGetByCriteriaValidator = vine.compile(
  vine.object({
    ...caisseSessionsCriteriaFields,
    date_from: vine.date({ formats: ['iso8601'] }),
    date_to: vine.date({ formats: ['iso8601'] }),
  })
)

export const caisseSessionIdValidator = vine.compile(
  vine.object({ id: vine.number().positive() })
)
