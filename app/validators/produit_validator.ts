import vine from '@vinejs/vine'

const stockAlertValues = ['rupture', 'alerte', 'normal', 'surstock'] as const

const produitFields = {
  nom: vine.string().trim().minLength(1).maxLength(200),
  code: vine.string().trim().maxLength(50).optional(),
  description: vine.string().trim().optional(),
  categorie_id: vine.number().positive().optional(),
  tva_groupe_id: vine.number().positive(),
  prix_achat_ht: vine.number().min(0).optional(),
  moyenne_achat_ht: vine.number().min(0).optional(),
  dernier_prix_achat_ht: vine.number().min(0).optional(),
  prix_vente_ttc: vine.number().min(0).optional(),
  frais: vine.number().min(0).optional(),
  unite: vine.string().trim().maxLength(50).optional(),
  unite_gros: vine.string().trim().maxLength(50).optional(),
  contenance: vine.number().positive().optional(),
  vente_au_detail: vine.boolean().optional(),
  stock_minimum: vine.number().min(0).optional(),
  stock_maximum: vine.number().min(0).optional(),
  airsi_pct: vine.number().min(0).max(100).optional(),
}

export const produitSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    nom: vine.string().trim().optional(),
    code: vine.string().trim().optional(),
    categorie_id: vine.number().positive().optional(),
    tva_groupe_id: vine.number().positive().optional(),
    is_active: vine.boolean().optional(),
    stock_alert: vine.enum(stockAlertValues).optional(),
    search: vine.string().trim().minLength(1).maxLength(200).optional(),
  })
)

export const produitIdValidator = vine.compile(vine.object({ id: vine.number().positive() }))

export const produitCreateValidator = vine.compile(vine.object(produitFields))

export const produitUpdateValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    nom: vine.string().trim().minLength(1).maxLength(200).optional(),
    code: vine.string().trim().maxLength(50).optional(),
    description: vine.string().trim().optional(),
    categorie_id: vine.number().positive().nullable().optional(),
    tva_groupe_id: vine.number().positive().optional(),
    prix_achat_ht: vine.number().min(0).optional(),
    moyenne_achat_ht: vine.number().min(0).optional(),
    dernier_prix_achat_ht: vine.number().min(0).optional(),
    prix_vente_ht: vine.number().min(0).optional(),
    prix_vente_ttc: vine.number().min(0).optional(),
    frais: vine.number().min(0).optional(),
    plancher: vine.number().min(0).optional(),
    unite: vine.string().trim().maxLength(50).optional(),
    unite_gros: vine.string().trim().maxLength(50).optional(),
    contenance: vine.number().positive().optional(),
    vente_au_detail: vine.boolean().optional(),
    stock_minimum: vine.number().min(0).optional(),
    stock_maximum: vine.number().min(0).optional(),
    is_active: vine.boolean().optional(),
    airsi_pct: vine.number().min(0).max(100).optional(),
  })
)

export const produitAjustementValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    type: vine.enum(['entree', 'sortie'] as const),
    /** Quantité en unité de détail (rétrocompatibilité) */
    quantite: vine.number().positive().optional(),
    /** Nombre de pièces / sacs / cartons */
    quantite_pieces: vine.number().min(0).optional(),
    /** Reliquat en unité de détail (kg, litre…) — si vente au détail activée */
    quantite_detail: vine.number().min(0).optional(),
    notes: vine.string().trim().optional(),
    depot_id: vine.number().positive().optional(),
  })
)

export const produitCalculPrixValidator = vine.compile(
  vine.object({
    prix_vente_ttc: vine.number().min(0).optional(),
    prix_achat_ht: vine.number().min(0).optional(),
    frais: vine.number().min(0).optional(),
    tva_groupe_id: vine.number().positive(),
  })
)

export const produitAlertesValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    depot_id: vine.number().positive().optional(),
  })
)
