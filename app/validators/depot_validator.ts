import vine from '@vinejs/vine'

const depotFields = {
  code: vine.string().trim().maxLength(20).optional(),
  nom: vine.string().trim().minLength(1).maxLength(150),
  adresse: vine.string().trim().optional(),
  is_default: vine.boolean().optional(),
}

export const depotSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    nom: vine.string().trim().optional(),
    code: vine.string().trim().optional(),
    is_active: vine.boolean().optional(),
    search: vine.string().trim().optional(),
  })
)

export const depotIdValidator = vine.compile(vine.object({ id: vine.number().positive() }))

export const depotDeactivateValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    transfer_to_depot_id: vine.number().positive().optional(),
  })
)

export const depotCreateValidator = vine.compile(
  vine.object({
    ...depotFields,
    code: vine.string().trim().minLength(1).maxLength(20).optional(),
  })
)

export const depotUpdateValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    code: vine.string().trim().minLength(1).maxLength(20).optional(),
    nom: vine.string().trim().minLength(1).maxLength(150).optional(),
    adresse: vine.string().trim().nullable().optional(),
    is_default: vine.boolean().optional(),
    is_active: vine.boolean().optional(),
  })
)

export const depotStockSearchValidator = vine.compile(
  vine.object({
    depot_id: vine.number().positive(),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    search: vine.string().trim().optional(),
  })
)

export const depotTransfertValidator = vine.compile(
  vine.object({
    produit_id: vine.number().positive(),
    /** Quantité en unité gros par défaut ; utiliser mode_vente: detail pour l'unité détail */
    quantite: vine.number().positive().optional(),
    /** Nombre de pièces / sacs / cartons */
    quantite_pieces: vine.number().min(0).optional(),
    /** Reliquat en unité de détail (kg, litre…) */
    quantite_detail: vine.number().min(0).optional(),
    mode_vente: vine.enum(['piece', 'detail'] as const).optional(),
    modeVente: vine.enum(['piece', 'detail'] as const).optional(),
    depot_source_id: vine.number().positive(),
    depot_dest_id: vine.number().positive(),
    notes: vine.string().trim().optional(),
  })
)
