/** Codes FNE dérivés du taux TVA : 18 % → TVA, 9 % → TVAB, 0 % → TVAC */
export const FNE_TVA_CODES = {
  TVA: 18,
  TVAB: 9,
  TVAC: 0,
} as const

export type FneNomTva = keyof typeof FNE_TVA_CODES

const TAUX_TO_FNE: Record<number, FneNomTva> = {
  18: 'TVA',
  9: 'TVAB',
  0: 'TVAC',
}

export function fneNomTvaFromTaux(taux: number): FneNomTva {
  const rounded = Math.round(taux * 100) / 100
  const code = TAUX_TO_FNE[rounded]
  if (!code) {
    throw new Error(
      `Taux TVA ${taux} % non supporté pour la FNE (attendu : 18 %, 9 % ou 0 %)`
    )
  }
  return code
}

export function calcAirsi(totalTtc: number, airsiPct: number) {
  const montant = Math.round(totalTtc * (airsiPct / 100) * 100) / 100
  const totalApresAirsi = Math.round((totalTtc - montant) * 100) / 100
  return { airsiMontant: montant, totalApresAirsi }
}
