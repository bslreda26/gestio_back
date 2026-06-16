import { loadProduitCodeMap } from '#helpers/produit_codes'
import Produit from '#models/produit'
import type VenteLigne from '#models/vente_ligne'
import { calcMargeLigne } from '#services/pricing_service'
import {
  resolvePlancherLigne,
  resolvePrixUnitaireLigne,
  type ModeVente,
} from '#services/vente_unite_service'

export type VenteLigneSerializeOptions = {
  code?: string
  includeMarge?: boolean
  includePlancher?: boolean
  plancher?: number
  marge?: number
}

function ligneMode(ligne: VenteLigne): ModeVente {
  return (ligne.modeVente as ModeVente) || 'piece'
}

function pricingFromProduit(
  ligne: VenteLigne,
  produit: Produit | undefined,
  options?: Pick<VenteLigneSerializeOptions, 'includeMarge' | 'includePlancher'>
) {
  if (!produit) return {}

  const mode = ligneMode(ligne)
  const plancher = resolvePlancherLigne(produit, mode)
  const result: { plancher?: number; marge?: number } = {}

  if (options?.includePlancher) {
    result.plancher = plancher
  }

  if (options?.includeMarge) {
    const prixUnitaire = Number(ligne.prixUnitaire)
    result.marge = calcMargeLigne(prixUnitaire, plancher)
  }

  return result
}

export function serializeVenteLigne(ligne: VenteLigne, options?: VenteLigneSerializeOptions) {
  const base: Record<string, unknown> = {
    id: ligne.id,
    venteId: ligne.venteId,
    produitId: ligne.produitId,
    code: options?.code,
    designation: ligne.designation,
    modeVente: ligne.modeVente ?? 'piece',
    quantite: Number(ligne.quantite),
    quantiteStock: ligne.quantiteStock !== null ? Number(ligne.quantiteStock) : Number(ligne.quantite),
    prixUnitaire: Number(ligne.prixUnitaire),
    remisePct: Number(ligne.remisePct),
    tvaPct: Number(ligne.tvaPct),
    montantHt: Number(ligne.montantHt),
    montantTva: Number(ligne.montantTva),
    montantTtc: Number(ligne.montantTtc),
    quantiteRetournee: Number(ligne.quantiteRetournee),
    ligneOrigineId: ligne.ligneOrigineId,
    createdAt: ligne.createdAt,
    updatedAt: ligne.updatedAt,
  }

  if (options?.includePlancher) {
    const plancher = options.plancher ?? Number(ligne.plancherLigne)
    base.plancher = plancher
    base.plancherLigne = plancher
  }

  if (options?.includeMarge) {
    base.marge = options.marge ?? Number(ligne.marge)
  }

  return base
}

export function serializeVenteLignes(
  lignes: VenteLigne[],
  options?: VenteLigneSerializeOptions & {
    codes?: Map<number, string>
    produits?: Map<number, Produit>
  }
) {
  return lignes.map((ligne) => {
    const livePricing = pricingFromProduit(ligne, options?.produits?.get(ligne.produitId), options)
    return serializeVenteLigne(ligne, {
      includeMarge: options?.includeMarge,
      includePlancher: options?.includePlancher,
      code: options?.codes?.get(ligne.produitId),
      plancher: livePricing.plancher,
      marge: livePricing.marge,
    })
  })
}

export async function serializeVenteLignesForApi(
  lignes: VenteLigne[],
  options?: Pick<VenteLigneSerializeOptions, 'includeMarge' | 'includePlancher'>
) {
  const produitIds = [...new Set(lignes.map((l) => l.produitId))]
  const [codes, produits] = await Promise.all([
    loadProduitCodeMap(produitIds),
    produitIds.length ? Produit.query().whereIn('id', produitIds) : Promise.resolve([]),
  ])

  return serializeVenteLignes(lignes, {
    ...options,
    codes,
    produits: new Map(produits.map((p) => [p.id, p])),
  })
}
