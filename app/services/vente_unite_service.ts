import { calcCmupHt, roundMoney } from '#services/pricing_service'
import type Produit from '#models/produit'

export type ModeVente = 'piece' | 'detail'

export type ProduitUniteFields = Pick<Produit, 'unite' | 'uniteGros' | 'contenance' | 'venteAuDetail'>

export function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Unité détail + unité gros + contenance > 1 — requis pour vente/achat au détail. */
export function hasUniteDetailConfig(
  produit: Pick<Produit, 'unite' | 'uniteGros' | 'contenance'>
): boolean {
  const uniteDetail = produit.unite?.trim()
  const uniteGros = produit.uniteGros?.trim()
  const contenance = Number(produit.contenance ?? 0)
  return Boolean(uniteDetail && uniteGros && contenance > 1)
}

/** Produit compté en gros simple : quantité achat/vente = quantité stock (1:1). */
export function isProduitGrosSimple(produit: Pick<Produit, 'unite' | 'uniteGros' | 'contenance'>) {
  return !hasUniteDetailConfig(produit)
}

export function getContenance(produit: Pick<Produit, 'contenance' | 'unite' | 'uniteGros'>): number {
  if (!hasUniteDetailConfig(produit)) return 1
  const contenance = Number(produit.contenance ?? 1)
  return contenance > 0 ? contenance : 1
}

export function canVenteAuDetail(produit: ProduitUniteFields): boolean {
  return Boolean(produit.venteAuDetail) && hasUniteDetailConfig(produit)
}

/**
 * When a product gains gros+detail config, stock was previously stored 1:1 (gros simple).
 * Multiply by contenance so existing quantities match the new internal detail unit.
 * When detail config is removed, divide by the old contenance so stock stays in gros units.
 */
export function convertStockWhenEnablingDetailConfig(
  stockActuel: number,
  before: Pick<Produit, 'unite' | 'uniteGros' | 'contenance'>,
  after: Pick<Produit, 'unite' | 'uniteGros' | 'contenance'>
): number {
  if (stockActuel <= 0) return stockActuel

  const hadDetail = hasUniteDetailConfig(before)
  const hasDetail = hasUniteDetailConfig(after)
  if (hadDetail === hasDetail) return stockActuel

  if (hasDetail) {
    return roundQty(stockActuel * getContenance(after))
  }

  return roundQty(stockActuel / getContenance(before))
}

export function normalizeProduitUniteFields(input: {
  unite?: string | null
  unite_gros?: string | null
  contenance?: number | null
  vente_au_detail?: boolean | null
}) {
  const unite = input.unite?.trim() || null
  const uniteGros = input.unite_gros?.trim() || null
  const contenanceRaw = input.contenance
  const detailConfig = Boolean(
    unite && uniteGros && contenanceRaw != null && Number(contenanceRaw) > 1
  )

  return {
    unite: unite ?? 'pièce',
    uniteGros: uniteGros,
    contenance: detailConfig ? Number(contenanceRaw) : 1,
    venteAuDetail: detailConfig ? Boolean(input.vente_au_detail) : false,
    venteDetailDisponible: detailConfig,
  }
}

function stockUnitLabel(produit: Pick<Produit, 'unite' | 'uniteGros'>) {
  const gros = produit.uniteGros?.trim()
  if (gros) return gros
  const detail = produit.unite?.trim()
  if (detail && detail !== 'pièce') return detail
  return ''
}

/** Quantité déduite du stock (1:1 en gros simple ; sinon unité détail interne). */
export function toStockQuantite(
  mode: ModeVente,
  quantite: number,
  produit: Pick<Produit, 'contenance' | 'unite' | 'uniteGros'>
): number {
  if (isProduitGrosSimple(produit)) {
    return roundQty(quantite)
  }
  const contenance = getContenance(produit)
  if (mode === 'piece') return roundQty(quantite * contenance)
  return roundQty(quantite)
}

/** Prix unitaire affiché sur la ligne (par pièce ou par unité de détail) */
export function resolvePrixUnitaireLigne(
  produit: Pick<Produit, 'prixVenteTtc' | 'contenance'>,
  mode: ModeVente,
  override?: number
): number {
  const contenance = getContenance(produit)
  if (mode === 'detail' && contenance > 1) {
    if (override !== undefined) return override
    return roundMoney(Number(produit.prixVenteTtc) / contenance)
  }
  return override !== undefined ? override : Number(produit.prixVenteTtc)
}

/**
 * Stockage interne : unité détail si contenance configurée, sinon unité gros.
 * CMUP et plancher sont toujours calculés dans cette unité de stockage.
 */

export function storesPrixEnDetail(
  produit: Pick<Produit, 'contenance' | 'unite' | 'uniteGros'>
): boolean {
  return hasUniteDetailConfig(produit)
}

export function detailToGros(valeur: number, produit: Pick<Produit, 'contenance' | 'unite' | 'uniteGros'>) {
  if (isProduitGrosSimple(produit)) return roundMoney(valeur)
  return roundMoney(valeur * getContenance(produit))
}

export function grosToDetail(valeur: number, produit: Pick<Produit, 'contenance' | 'unite' | 'uniteGros'>) {
  if (isProduitGrosSimple(produit)) return roundMoney(valeur)
  return roundMoney(valeur / getContenance(produit))
}

/** Saisie catalogue (gros) → stockage interne */
export function toProduitPrixStockage(
  prixHtGros: number,
  fraisGros: number,
  produit: Pick<Produit, 'contenance' | 'unite' | 'uniteGros'>
): { prixAchatHt: number; frais: number } {
  return {
    prixAchatHt: grosToDetail(prixHtGros, produit),
    frais: grosToDetail(fraisGros, produit),
  }
}

export function toPlancherStockage(
  plancherGros: number,
  produit: Pick<Produit, 'contenance' | 'unite' | 'uniteGros'>
): number {
  return grosToDetail(plancherGros, produit)
}

export type ProduitCataloguePrixGros = {
  mode: 'gros'
  prixAchatHt: number
  moyenneAchatHt: number
  prixAchatTtc: number
  frais: number
  plancher: number
}

export type ProduitCataloguePrixDetail = {
  mode: 'detail'
  uniteDetail: string
  uniteGros: string
  contenance: number
  prixAchatHtDetail: number
  prixAchatHtGros: number
  moyenneAchatHtDetail: number
  moyenneAchatHtGros: number
  prixAchatTtcDetail: number
  prixAchatTtcGros: number
  fraisDetail: number
  fraisGros: number
  plancherDetail: number
  plancherGros: number
}

export type ProduitCataloguePrix = ProduitCataloguePrixGros | ProduitCataloguePrixDetail

/** Stockage interne → affichage catalogue (détail + gros si contenance). */
export function fromProduitPrixStockage(
  produit: Pick<
    Produit,
    'prixAchatHt' | 'prixAchatTtc' | 'frais' | 'plancher' | 'contenance' | 'unite' | 'uniteGros'
  >,
  tauxTva?: number
): ProduitCataloguePrix {
  const prixAchatHtDetail = roundMoney(Number(produit.prixAchatHt))
  const fraisDetail = roundMoney(Number(produit.frais))
  const plancherDetail = roundMoney(Number(produit.plancher))
  const prixAchatTtcDetail = roundMoney(Number(produit.prixAchatTtc))
  const moyenneAchatHtDetail =
    tauxTva !== undefined
      ? calcCmupHt(prixAchatHtDetail, fraisDetail, tauxTva)
      : prixAchatHtDetail

  if (isProduitGrosSimple(produit)) {
    return {
      mode: 'gros',
      prixAchatHt: prixAchatHtDetail,
      moyenneAchatHt: moyenneAchatHtDetail,
      prixAchatTtc: prixAchatTtcDetail,
      frais: fraisDetail,
      plancher: plancherDetail,
    }
  }

  const contenance = getContenance(produit)
  return {
    mode: 'detail',
    uniteDetail: produit.unite ?? 'unité',
    uniteGros: produit.uniteGros ?? 'pièce',
    contenance,
    prixAchatHtDetail,
    prixAchatHtGros: detailToGros(prixAchatHtDetail, produit),
    moyenneAchatHtDetail,
    moyenneAchatHtGros: detailToGros(moyenneAchatHtDetail, produit),
    prixAchatTtcDetail,
    prixAchatTtcGros: detailToGros(prixAchatTtcDetail, produit),
    fraisDetail,
    fraisGros: detailToGros(fraisDetail, produit),
    plancherDetail,
    plancherGros: detailToGros(plancherDetail, produit),
  }
}

export function cataloguePrixGros(prix: ProduitCataloguePrix): number {
  return prix.mode === 'detail' ? prix.prixAchatHtGros : prix.prixAchatHt
}

export function catalogueFraisGros(prix: ProduitCataloguePrix): number {
  return prix.mode === 'detail' ? prix.fraisGros : prix.frais
}

export function cataloguePlancherGros(prix: ProduitCataloguePrix): number {
  return prix.mode === 'detail' ? prix.plancherGros : prix.plancher
}

/** @deprecated Utiliser fromProduitPrixStockage */
export function toProduitCataloguePrix(
  produit: Pick<
    Produit,
    'prixAchatHt' | 'prixAchatTtc' | 'frais' | 'plancher' | 'contenance' | 'unite' | 'uniteGros'
  >
): ProduitCataloguePrix {
  return fromProduitPrixStockage(produit)
}

/** Alias rétrocompat — conversion stockage → gros uniquement */
export function toProduitPrixAffichage(
  prixAchatHt: number,
  frais: number,
  produit: Pick<Produit, 'contenance' | 'unite' | 'uniteGros'>
): { prixAchatHtGros: number; fraisGros: number } {
  return {
    prixAchatHtGros: detailToGros(prixAchatHt, produit),
    fraisGros: detailToGros(frais, produit),
  }
}

export function toPlancherAffichage(
  plancher: number,
  produit: Pick<Produit, 'contenance' | 'unite' | 'uniteGros'>
): number {
  return detailToGros(plancher, produit)
}

/**
 * Lors du passage gros simple ↔ gros+détail, convertir les prix catalogue entre
 * unité gros et unité détail de stockage interne (comme pour le stock).
 */
export function convertPricingWhenEnablingDetailConfig(
  prixAchatHt: number,
  frais: number,
  plancher: number,
  before: Pick<Produit, 'unite' | 'uniteGros' | 'contenance'>,
  after: Pick<Produit, 'unite' | 'uniteGros' | 'contenance'>
) {
  const hadDetail = hasUniteDetailConfig(before)
  const hasDetail = hasUniteDetailConfig(after)
  if (hadDetail === hasDetail) {
    return { prixAchatHt, frais, plancher }
  }

  if (hasDetail) {
    const stockage = toProduitPrixStockage(prixAchatHt, frais, after)
    return {
      prixAchatHt: stockage.prixAchatHt,
      frais: stockage.frais,
      plancher: toPlancherStockage(plancher, after),
    }
  }

  return {
    prixAchatHt: detailToGros(prixAchatHt, before),
    frais: detailToGros(frais, before),
    plancher: detailToGros(plancher, before),
  }
}

/** Plancher pour la ligne selon le mode de vente (stockage interne = unité détail). */
export function resolvePlancherLigne(
  produit: Pick<Produit, 'plancher' | 'contenance' | 'unite' | 'uniteGros'>,
  mode: ModeVente
): number {
  const plancher = Number(produit.plancher)
  if (isProduitGrosSimple(produit)) return roundMoney(plancher)
  if (mode === 'detail') return roundMoney(plancher)
  return roundMoney(plancher * getContenance(produit))
}

/** Décompose le stock (en unité de détail) en pièces entières + reliquat */
export function splitStockDetail(stockDetail: number, contenance: number) {
  const stock = roundQty(stockDetail)
  if (contenance <= 1) {
    return {
      stock_detail: stock,
      pieces: stock,
      reste_detail: 0,
    }
  }

  const pieces = Math.floor(stock / contenance + 1e-9)
  const reste_detail = roundQty(stock - pieces * contenance)

  return {
    stock_detail: stock,
    pieces,
    reste_detail,
  }
}

export function formatStockLabel(
  produit: Pick<Produit, 'unite' | 'uniteGros' | 'contenance' | 'venteAuDetail'>,
  stockDetail: number,
  showDetailBreakdown = canVenteAuDetail(produit)
) {
  const stock = roundQty(stockDetail)
  if (isProduitGrosSimple(produit)) {
    const unit = stockUnitLabel(produit)
    return unit ? `${stock} ${unit}` : `${stock}`
  }

  const contenance = getContenance(produit)
  const { pieces, reste_detail } = splitStockDetail(stockDetail, contenance)
  const uniteGros = produit.uniteGros ?? 'pièce'
  const uniteDetail = produit.unite ?? 'unité'

  if (contenance <= 1) {
    return `${pieces} ${uniteGros}`
  }

  /** Toujours afficher le reliquat si contenance > 1 (stock interne en unité détail). */
  const showRemainder = showDetailBreakdown || reste_detail > 0

  if (!showRemainder || reste_detail <= 0) {
    return `${pieces} ${uniteGros}`
  }

  if (pieces <= 0) {
    return `${reste_detail} ${uniteDetail}`
  }

  return `${pieces} ${uniteGros} + ${reste_detail} ${uniteDetail}`
}

/** Stock affiché : quantité simple ou pièces + reliquat détail si configuré. */
export function resolveStockDisplay(
  produit: Pick<Produit, 'unite' | 'uniteGros' | 'contenance' | 'venteAuDetail'>,
  stockDetail: number
) {
  if (isProduitGrosSimple(produit)) {
    const stock = roundQty(stockDetail)
    return {
      stockDetail: stock,
      stockPieces: stock,
      stockResteDetail: 0,
      stockLabel: formatStockLabel(produit, stockDetail, false),
      venteAuDetail: false,
    }
  }

  const contenance = getContenance(produit)
  const { pieces, reste_detail } = splitStockDetail(stockDetail, contenance)
  const showDetailBreakdown = canVenteAuDetail(produit)
  const showRemainder = contenance > 1 && (showDetailBreakdown || reste_detail > 0)

  return {
    stockDetail: roundQty(stockDetail),
    stockPieces: pieces,
    stockResteDetail: showRemainder ? reste_detail : 0,
    stockLabel: formatStockLabel(produit, stockDetail, showDetailBreakdown),
    venteAuDetail: showDetailBreakdown,
  }
}

export type AjustementQuantiteInput = {
  quantite?: number
  quantite_pieces?: number
  quantite_detail?: number
}

export class AjustementQuantiteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AjustementQuantiteError'
  }
}

/** Convertit pièces + détail (sac + kg) en quantité stock (unité de détail) */
export function resolveAjustementQuantite(
  produit: Pick<Produit, 'contenance' | 'venteAuDetail' | 'nom' | 'unite' | 'uniteGros'>,
  input: AjustementQuantiteInput
): number {
  const hasPieces = input.quantite_pieces !== undefined
  const hasDetail = input.quantite_detail !== undefined

  if (hasPieces || hasDetail) {
    const pieces = input.quantite_pieces ?? 0
    const detail = input.quantite_detail ?? 0
    if (pieces < 0 || detail < 0) {
      throw new AjustementQuantiteError('Les quantités ne peuvent pas être négatives')
    }
    if (pieces === 0 && detail === 0) {
      throw new AjustementQuantiteError('Indiquez une quantité en pièces et/ou au détail')
    }

    const contenance = getContenance(produit)
    if (contenance <= 1) {
      const qty = pieces > 0 ? pieces : detail
      if (qty <= 0) {
        throw new AjustementQuantiteError('Quantité requise')
      }
      return roundQty(qty)
    }

    if (canVenteAuDetail(produit)) {
      if (detail >= contenance) {
        const uniteDetail = produit.unite ?? 'unité'
        throw new AjustementQuantiteError(
          `La quantité ${uniteDetail} doit être inférieure à la contenance (${contenance})`
        )
      }
      return roundQty(pieces * contenance + detail)
    }

    if (detail > 0) {
      throw new AjustementQuantiteError(
        `Le produit ${produit.nom} ne permet pas d'ajustement au détail`
      )
    }
    if (pieces <= 0) {
      throw new AjustementQuantiteError('Indiquez le nombre de pièces')
    }
    return roundQty(pieces * contenance)
  }

  if (input.quantite === undefined || input.quantite <= 0) {
    throw new AjustementQuantiteError('Quantité requise')
  }
  return roundQty(input.quantite)
}

export function assertModeVenteAllowed(
  produit: Pick<Produit, 'venteAuDetail' | 'contenance' | 'nom'>,
  mode: ModeVente
) {
  if (mode === 'detail' && !canVenteAuDetail(produit)) {
    throw new Error(`Le produit ${produit.nom} ne peut pas être vendu au détail`)
  }
}

export function assertModeAchatAllowed(
  produit: Pick<Produit, 'venteAuDetail' | 'contenance' | 'nom'>,
  mode: ModeVente
) {
  if (mode === 'detail' && !canVenteAuDetail(produit)) {
    throw new Error(`Le produit ${produit.nom} ne peut pas être acheté au détail`)
  }
}

/** Convertit un prix ligne achat vers l'unité gros (pièce / sac…) */
export function toPrixAchatGros(
  prixUnitaireHt: number,
  frais: number,
  modeAchat: ModeVente,
  produit: Pick<Produit, 'contenance'>
): { prixUnitaireHt: number; frais: number } {
  const contenance = getContenance(produit)
  if (modeAchat === 'detail' && contenance > 1) {
    return {
      prixUnitaireHt: roundMoney(prixUnitaireHt * contenance),
      frais: roundMoney(frais * contenance),
    }
  }
  return {
    prixUnitaireHt: roundMoney(prixUnitaireHt),
    frais: roundMoney(frais),
  }
}

/** Convertit un prix gros vers l'unité affichée sur la ligne achat */
export function fromPrixAchatGros(
  prixGros: number,
  fraisGros: number,
  mode: ModeVente,
  produit: Pick<Produit, 'contenance'>
): { prixUnitaireHt: number; frais: number } {
  const contenance = getContenance(produit)
  if (mode === 'detail' && contenance > 1) {
    return {
      prixUnitaireHt: roundMoney(prixGros / contenance),
      frais: roundMoney(fraisGros / contenance),
    }
  }
  return {
    prixUnitaireHt: roundMoney(prixGros),
    frais: roundMoney(fraisGros),
  }
}

/** Prix HT affiché sur la ligne achat (par pièce/gros ou par unité de détail) — fallback catalogue */
export function resolvePrixAchatHt(
  produit: Pick<Produit, 'prixAchatHt' | 'contenance' | 'unite' | 'uniteGros' | 'prixAchatTtc' | 'frais' | 'plancher'>,
  mode: ModeVente,
  prixGros?: number
): number {
  const prixGrosResolved = prixGros ?? cataloguePrixGros(fromProduitPrixStockage(produit))
  return fromPrixAchatGros(prixGrosResolved, 0, mode, produit).prixUnitaireHt
}

/** Frais affichés sur la ligne achat (même unité que le prix ligne) — fallback catalogue */
export function resolveFraisAchat(
  produit: Pick<Produit, 'frais' | 'contenance' | 'unite' | 'uniteGros' | 'prixAchatHt' | 'prixAchatTtc' | 'plancher'>,
  mode: ModeVente,
  fraisGros?: number
): number {
  const fraisGrosResolved = fraisGros ?? catalogueFraisGros(fromProduitPrixStockage(produit))
  return fromPrixAchatGros(0, fraisGrosResolved, mode, produit).frais
}

/** Valeurs pour le CMUP stock (1:1 en gros simple ; sinon unité détail interne). */
export function toAchatCmupUnits(
  mode: ModeVente,
  quantiteRecue: number,
  prixUnitaireHt: number,
  fraisUnitaire: number,
  produit: Pick<Produit, 'contenance' | 'unite' | 'uniteGros'>
) {
  const quantiteStock = toStockQuantite(mode, quantiteRecue, produit)
  if (isProduitGrosSimple(produit)) {
    return {
      quantiteStock,
      prixUnitaireHt: roundMoney(prixUnitaireHt),
      fraisUnitaire: roundMoney(fraisUnitaire),
    }
  }
  const contenance = getContenance(produit)
  if (mode === 'detail' && contenance > 1) {
    return {
      quantiteStock,
      prixUnitaireHt,
      fraisUnitaire,
    }
  }
  return {
    quantiteStock,
    prixUnitaireHt: roundMoney(prixUnitaireHt / contenance),
    fraisUnitaire: roundMoney(fraisUnitaire / contenance),
  }
}

export function achatLigneMode(ligne: { modeAchat?: string | null }): ModeVente {
  return ligne.modeAchat === 'detail' ? 'detail' : 'piece'
}

/** Quantité stockée sur une ligne achat (rétrocompat : anciennes lignes sans quantite_stock) */
export function ligneAchatQuantiteStock(ligne: {
  quantiteStock?: string | null
  quantite: string | number
}): number {
  if (ligne.quantiteStock !== null && ligne.quantiteStock !== undefined) {
    return Number(ligne.quantiteStock)
  }
  return Number(ligne.quantite)
}

/** Quantité stockée sur une ligne (rétrocompat : anciennes lignes sans quantite_stock) */
export function ligneQuantiteStock(ligne: {
  quantiteStock?: string | null
  quantite: string | number
}): number {
  if (ligne.quantiteStock !== null && ligne.quantiteStock !== undefined) {
    return Number(ligne.quantiteStock)
  }
  return Number(ligne.quantite)
}
