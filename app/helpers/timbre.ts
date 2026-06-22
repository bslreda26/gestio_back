import { FNE_PAYMENT_METHOD, type FnePaymentMethod } from '#constants/fne_payment'
import { roundMoney } from '#services/pricing_service'

/**
 * Montant du timbre fiscal (FCFA) selon le total TTC des articles.
 * Tranches : ≤5 000 → 0 ; ≤100 000 → 100 ; ≤500 000 → 500 ;
 * ≤1 000 000 → 1 000 ; ≤5 000 000 → 2 000 ; au-delà → 5 000.
 */
export function computeMontantTimbreFromTotalTtc(totalTtc: number): number {
  const ttc = Math.max(0, Number(totalTtc))
  if (ttc <= 5000) return 0
  if (ttc <= 100_000) return 100
  if (ttc <= 500_000) return 500
  if (ttc <= 1_000_000) return 1000
  if (ttc <= 5_000_000) return 2000
  return 5000
}

export function resolveMontantTimbre(
  modePaiementFne: string | null | undefined,
  totalTtc: number
): number {
  const mode = (modePaiementFne?.trim() || FNE_PAYMENT_METHOD.DEFERRED) as FnePaymentMethod
  if (mode !== FNE_PAYMENT_METHOD.CASH) return 0
  return computeMontantTimbreFromTotalTtc(totalTtc)
}

export function venteTotalAPayer(input: {
  totalApresAirsi: number | string
  montantTimbre?: number | string | null
}): number {
  return roundMoney(Number(input.totalApresAirsi) + Number(input.montantTimbre ?? 0))
}
