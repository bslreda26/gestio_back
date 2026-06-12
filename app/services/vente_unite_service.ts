import { roundMoney } from '#services/pricing_service'
import type Produit from '#models/produit'

export type ModeVente = 'piece' | 'detail'

export function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function getContenance(produit: Pick<Produit, 'contenance'>): number {
  const contenance = Number(produit.contenance ?? 1)
  return contenance > 0 ? contenance : 1
}

export function canVenteAuDetail(produit: Pick<Produit, 'venteAuDetail' | 'contenance'>): boolean {
  return Boolean(produit.venteAuDetail) && getContenance(produit) > 1
}

/** Quantité déduite du stock (toujours en unité de détail : kg, litre…) */
export function toStockQuantite(
  mode: ModeVente,
  quantite: number,
  produit: Pick<Produit, 'contenance'>
): number {
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

/** Plancher pour la ligne selon le mode de vente */
export function resolvePlancherLigne(
  produit: Pick<Produit, 'plancher' | 'contenance'>,
  mode: ModeVente
): number {
  const plancher = Number(produit.plancher)
  const contenance = getContenance(produit)
  if (mode === 'detail' && contenance > 1) {
    return roundMoney(plancher / contenance)
  }
  return plancher
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
  const contenance = getContenance(produit)
  const { pieces, reste_detail } = splitStockDetail(stockDetail, contenance)
  const uniteGros = produit.uniteGros ?? 'pièce'
  const uniteDetail = produit.unite ?? 'unité'

  if (contenance <= 1 || !showDetailBreakdown) {
    return `${pieces} ${uniteGros}`
  }

  if (reste_detail <= 0) {
    return `${pieces} ${uniteGros}`
  }

  if (pieces <= 0) {
    return `${reste_detail} ${uniteDetail}`
  }

  return `${pieces} ${uniteGros} + ${reste_detail} ${uniteDetail}`
}

/** Stock affiché : pièces seules, ou pièces + reliquat détail si vente au détail activée */
export function resolveStockDisplay(
  produit: Pick<Produit, 'unite' | 'uniteGros' | 'contenance' | 'venteAuDetail'>,
  stockDetail: number
) {
  const contenance = getContenance(produit)
  const { pieces, reste_detail } = splitStockDetail(stockDetail, contenance)
  const showDetailBreakdown = canVenteAuDetail(produit)

  return {
    stockDetail: roundQty(stockDetail),
    stockPieces: pieces,
    stockResteDetail: showDetailBreakdown ? reste_detail : 0,
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
