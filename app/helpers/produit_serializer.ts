import type Produit from '#models/produit'
import { getStockStatus } from '#helpers/produit_query'
import {
  fromProduitPrixStockage,
  getContenance,
  hasUniteDetailConfig,
  resolveStockDisplay,
  type ProduitCataloguePrix,
} from '#services/vente_unite_service'

function resolveTauxTva(
  extras: Record<string, unknown>,
  options?: { hidePlancher?: boolean; tauxTva?: number }
): number | undefined {
  if (options?.tauxTva !== undefined) return options.tauxTva
  const tvaGroupe = extras.tvaGroupe
  if (tvaGroupe && typeof tvaGroupe === 'object' && 'taux' in tvaGroupe) {
    return Number((tvaGroupe as { taux: number }).taux)
  }
  return undefined
}

function serializeCataloguePrix(
  prix: ProduitCataloguePrix,
  options?: { hidePlancher?: boolean }
): Record<string, number | string> {
  if (prix.mode === 'gros') {
    return {
      prixUniteStockage: 'gros',
      prixAchatHt: prix.prixAchatHt,
      moyenneAchatHt: prix.moyenneAchatHt,
      prixAchatTtc: prix.prixAchatTtc,
      frais: prix.frais,
      ...(options?.hidePlancher ? {} : { plancher: prix.plancher }),
    }
  }

  return {
    prixUniteStockage: 'detail',
    uniteDetail: prix.uniteDetail,
    uniteGros: prix.uniteGros,
    prixAchatHtDetail: prix.prixAchatHtDetail,
    prixAchatHtGros: prix.prixAchatHtGros,
    moyenneAchatHtDetail: prix.moyenneAchatHtDetail,
    moyenneAchatHtGros: prix.moyenneAchatHtGros,
    prixAchatTtcDetail: prix.prixAchatTtcDetail,
    prixAchatTtcGros: prix.prixAchatTtcGros,
    fraisDetail: prix.fraisDetail,
    fraisGros: prix.fraisGros,
    ...(options?.hidePlancher
      ? {}
      : {
          plancherDetail: prix.plancherDetail,
          plancherGros: prix.plancherGros,
        }),
    /** Rétrocompat — champs principaux = unité gros (saisie catalogue) */
    prixAchatHt: prix.prixAchatHtGros,
    moyenneAchatHt: prix.moyenneAchatHtGros,
    prixAchatTtc: prix.prixAchatTtcGros,
    frais: prix.fraisGros,
    ...(options?.hidePlancher ? {} : { plancher: prix.plancherGros }),
  }
}

export function serializeProduit(
  produit: Produit,
  extras: Record<string, unknown> = {},
  options?: { hidePlancher?: boolean; tauxTva?: number }
) {
  const json = produit.serialize()
  const tauxTva = resolveTauxTva(extras, options)
  const cataloguePrix = fromProduitPrixStockage(produit, tauxTva)
  const stockDetail = Number(json.stockActuel ?? produit.stockActuel)
  const contenance = getContenance(produit)
  const stockDisplay = resolveStockDisplay(produit, stockDetail)

  return {
    ...json,
    ...serializeCataloguePrix(cataloguePrix, options),
    /** Dernier prix d'achat HT connu (unité gros : pièce / sac…) */
    dernierPrixAchatHt: Number(json.dernierPrixAchatHt ?? produit.dernierPrixAchatHt ?? 0),
    contenance,
    venteDetailDisponible: hasUniteDetailConfig(produit),
    stockDetail: stockDisplay.stockDetail,
    stockPieces: stockDisplay.stockPieces,
    stockResteDetail: stockDisplay.stockResteDetail,
    stockLabel: stockDisplay.stockLabel,
    stockStatus: getStockStatus(
      stockDetail,
      Number(json.stockMinimum ?? produit.stockMinimum),
      Number(json.stockMaximum ?? produit.stockMaximum)
    ),
    ...extras,
  }
}

/** Champs prix catalogue pour ligne achat (actuel ou prévision après réception). */
export function serializeAchatCataloguePrix(
  prix: ProduitCataloguePrix,
  prefix = ''
): Record<string, number> {
  const key = (name: string) => (prefix ? `${name}_${prefix}` : name)

  if (prix.mode === 'gros') {
    return {
      [key('moyenne_achat_ht')]: prix.moyenneAchatHt,
      [key('prix_achat_ht')]: prix.prixAchatHt,
      [key('prix_achat_ttc')]: prix.prixAchatTtc,
      [key('frais')]: prix.frais,
      [key('plancher')]: prix.plancher,
    }
  }

  return {
    [key('moyenne_achat_ht_detail')]: prix.moyenneAchatHtDetail,
    [key('moyenne_achat_ht_gros')]: prix.moyenneAchatHtGros,
    [key('prix_achat_ht_detail')]: prix.prixAchatHtDetail,
    [key('prix_achat_ht_gros')]: prix.prixAchatHtGros,
    [key('prix_achat_ttc_detail')]: prix.prixAchatTtcDetail,
    [key('prix_achat_ttc_gros')]: prix.prixAchatTtcGros,
    [key('frais_detail')]: prix.fraisDetail,
    [key('frais_gros')]: prix.fraisGros,
    [key('plancher_detail')]: prix.plancherDetail,
    [key('plancher_gros')]: prix.plancherGros,
    [key('moyenne_achat_ht')]: prix.moyenneAchatHtGros,
    [key('prix_achat_ht')]: prix.prixAchatHtGros,
    [key('prix_achat_ttc')]: prix.prixAchatTtcGros,
    [key('frais')]: prix.fraisGros,
    [key('plancher')]: prix.plancherGros,
  }
}
