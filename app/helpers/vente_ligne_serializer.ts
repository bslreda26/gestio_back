import { loadProduitCodeMap } from '#helpers/produit_codes'
import { isTimbreProduitCode, resolveTimbreReference } from '#helpers/timbre'
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
  timbreReference?: string | null
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
  const code = options?.code
  const isTimbre = isTimbreProduitCode(code, options?.timbreReference)

  const base: Record<string, unknown> = {
    id: ligne.id,
    venteId: ligne.venteId,
    produitId: ligne.produitId,
    code,
    designation: ligne.designation,
    modeVente: ligne.modeVente ?? 'piece',
    prixUnitaire: Number(ligne.prixUnitaire),
    remisePct: Number(ligne.remisePct),
    tvaPct: Number(ligne.tvaPct),
    montantHt: Number(ligne.montantHt),
    montantTva: Number(ligne.montantTva),
    montantTtc: Number(ligne.montantTtc),
    airsiPct: Number(ligne.airsiPct),
    airsiMontant: Number(ligne.airsiMontant),
    montantApresAirsi: Number(ligne.montantApresAirsi),
    quantiteRetournee: Number(ligne.quantiteRetournee),
    ligneOrigineId: ligne.ligneOrigineId,
    depotId: ligne.depotId,
    createdAt: ligne.createdAt,
    updatedAt: ligne.updatedAt,
    isTimbre,
    sansQuantite: isTimbre,
  }

  if (!isTimbre) {
    base.quantite = Number(ligne.quantite)
    base.quantiteStock =
      ligne.quantiteStock !== null ? Number(ligne.quantiteStock) : Number(ligne.quantite)
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
    timbreReference?: string | null
  }
) {
  return lignes.map((ligne) => {
    const livePricing = pricingFromProduit(ligne, options?.produits?.get(ligne.produitId), options)
    return serializeVenteLigne(ligne, {
      includeMarge: options?.includeMarge,
      includePlancher: options?.includePlancher,
      code: options?.codes?.get(ligne.produitId),
      timbreReference: options?.timbreReference,
      plancher: livePricing.plancher,
      marge: livePricing.marge,
    })
  })
}

export async function serializeVenteLignesForApi(
  lignes: VenteLigne[],
  options?: Pick<VenteLigneSerializeOptions, 'includeMarge' | 'includePlancher'> & {
    pointDeVenteId?: number
  }
) {
  const produitIds = [...new Set(lignes.map((l) => l.produitId))]
  const timbreReference = options?.pointDeVenteId
    ? await resolveTimbreReference(options.pointDeVenteId)
    : null
  const [codes, produits] = await Promise.all([
    loadProduitCodeMap(produitIds),
    produitIds.length ? Produit.query().whereIn('id', produitIds) : Promise.resolve([]),
  ])

  return serializeVenteLignes(lignes, {
    ...options,
    timbreReference,
    codes,
    produits: new Map(produits.map((p) => [p.id, p])),
  })
}
