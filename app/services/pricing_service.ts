export type ProduitPricingInput = {
  prixAchatHt: number
  prixVenteHt: number
  frais: number
  tauxTva: number
}

export type ProduitPricingResult = {
  prixAchatTtc: number
  prixVenteTtc: number
  plancher: number
}

export class PlancherValidationError extends Error {
  constructor(
    public prixUnitaire: number,
    public plancher: number,
    public produitNom?: string
  ) {
    const label = produitNom ? ` pour ${produitNom}` : ''
    super(
      `Le prix facturé (${prixUnitaire}) est inférieur au plancher (${plancher})${label}`
    )
    this.name = 'PlancherValidationError'
  }
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** Marge unitaire catalogue : prix vente TTC − plancher */
export function calcMargeLigne(prixVenteTtc: number, plancher: number): number {
  return roundMoney(prixVenteTtc - plancher)
}

/** Marge totale d'une ligne (unitaire × quantité, après remise ligne). */
export function calcMargeTotaleLigne(
  margeUnitaire: number,
  quantite: number,
  remisePct = 0
): number {
  const brutMarge = roundMoney(margeUnitaire * quantite)
  return roundMoney(brutMarge * (1 - remisePct / 100))
}

export type LigneMargeInput = {
  marge: number
  quantite: number
  remisePct?: number
}

/** Marge facture = somme des marges lignes, ajustée par la remise globale. */
export function calculerMargeFacture(
  lignes: LigneMargeInput[],
  sousTotal: number,
  totalTtc: number
): { marge: number; margePct: number } {
  const margeBrute = roundMoney(
    lignes.reduce((sum, ligne) => sum + calcMargeTotaleLigne(ligne.marge, ligne.quantite, ligne.remisePct ?? 0), 0)
  )
  const marge = sousTotal > 0 ? roundMoney(margeBrute * (totalTtc / sousTotal)) : 0
  const margePct = totalTtc > 0 ? roundMoney((marge / totalTtc) * 100) : 0
  return { marge, margePct }
}

export function calcTtc(prixHt: number, tauxTva: number): number {
  return roundMoney(prixHt * (1 + tauxTva / 100))
}

export function calcHt(prixTtc: number, tauxTva: number): number {
  return roundMoney(prixTtc / (1 + tauxTva / 100))
}

/** Frais saisis TTC → composante HT incluse dans le CMUP (TTC / (1 + TVA%)). */
export function calcFraisHt(fraisTtc: number, tauxTva: number): number {
  return calcHt(fraisTtc, tauxTva)
}

/** CMUP HT = moyenne achat HT + frais HT */
export function calcCmupHt(prixAchatHt: number, fraisTtc: number, tauxTva: number): number {
  return roundMoney(prixAchatHt + calcFraisHt(fraisTtc, tauxTva))
}

/** Plancher TTC = CMUP HT × (1 + TVA%) — ex. CMUP × 1,18 à 18 %. */
export function calcPlancherFromCmup(cmupHt: number, tauxTva: number): number {
  return calcTtc(cmupHt, tauxTva)
}

/** Plancher TTC à partir de la moyenne achat HT (hors frais) et des frais TTC catalogue. */
export function calcPlancher(prixAchatHt: number, fraisTtc: number, tauxTva: number): number {
  return calcPlancherFromCmup(calcCmupHt(prixAchatHt, fraisTtc, tauxTva), tauxTva)
}

export function calcProduitPricing(input: ProduitPricingInput): ProduitPricingResult {
  const prixAchatTtc = calcTtc(input.prixAchatHt, input.tauxTva)
  const prixVenteTtc = calcTtc(input.prixVenteHt, input.tauxTva)
  const plancher = calcPlancher(input.prixAchatHt, input.frais, input.tauxTva)

  return { prixAchatTtc, prixVenteTtc, plancher }
}

export type ProduitPricingFromVenteTtcInput = {
  prixAchatHt: number
  prixVenteTtc: number
  frais: number
  tauxTva: number
}

export function calcProduitPricingFromVenteTtc(
  input: ProduitPricingFromVenteTtcInput
): ProduitPricingResult & { prixVenteHt: number } {
  const prixAchatTtc = calcTtc(input.prixAchatHt, input.tauxTva)
  const prixVenteTtc = roundMoney(input.prixVenteTtc)
  const prixVenteHt = calcHt(prixVenteTtc, input.tauxTva)
  const plancher = calcPlancher(input.prixAchatHt, input.frais, input.tauxTva)

  return { prixAchatTtc, prixVenteTtc, plancher, prixVenteHt }
}

export function updatePrixAchatFromAchat(prixUnitaireHt: number, tauxTva: number) {
  return {
    prixAchatHt: roundMoney(prixUnitaireHt),
    prixAchatTtc: calcTtc(prixUnitaireHt, tauxTva),
  }
}

export type AchatReceptionPricingInput = {
  stockAvant: number
  quantiteRecue: number
  prixUnitaireHt: number
  fraisUnitaire: number
  ancienPrixAchatHt: number
  ancienFrais: number
  tauxTva: number
}

/** Coût moyen pondéré : (stock × valeur actuelle + qté reçue × nouvelle valeur) / nouveau stock */
export function calcCmup(
  stockAvant: number,
  valeurUnitaireAvant: number,
  quantiteRecue: number,
  valeurUnitaireRecue: number
): number {
  const stockTotal = stockAvant + quantiteRecue
  if (stockTotal <= 0) return roundMoney(valeurUnitaireRecue)
  if (stockAvant <= 0) return roundMoney(valeurUnitaireRecue)
  return roundMoney(
    (stockAvant * valeurUnitaireAvant + quantiteRecue * valeurUnitaireRecue) / stockTotal
  )
}

/** Met à jour moyenne achat HT (CMUP), frais et plancher du produit après réception d'un achat */
export function updateProduitFromAchatReception(input: AchatReceptionPricingInput) {
  const prixAchatHt = calcCmup(
    input.stockAvant,
    input.ancienPrixAchatHt,
    input.quantiteRecue,
    input.prixUnitaireHt
  )
  const frais = calcCmup(
    input.stockAvant,
    input.ancienFrais,
    input.quantiteRecue,
    input.fraisUnitaire
  )
  const prixAchatTtc = calcTtc(prixAchatHt, input.tauxTva)
  const cmupHt = calcCmupHt(prixAchatHt, frais, input.tauxTva)
  const plancher = calcPlancherFromCmup(cmupHt, input.tauxTva)

  return { prixAchatHt, prixAchatTtc, frais, plancher }
}

/** Inverse du CMUP pondéré lors d'une annulation de réception. */
export function reverseCmup(
  stockApresRetrait: number,
  valeurApres: number,
  quantiteRetiree: number,
  valeurRetiree: number
): number {
  const stockAvant = stockApresRetrait
  const stockTotal = stockAvant + quantiteRetiree
  if (stockAvant <= 0) return roundMoney(valeurRetiree)
  return roundMoney((stockTotal * valeurApres - quantiteRetiree * valeurRetiree) / stockAvant)
}

export type AchatAnnulationPricingInput = {
  stockApresAnnulation: number
  quantiteRetireeStock: number
  prixUnitaireHtRetire: number
  fraisUnitaireRetire: number
  prixAchatHtActuel: number
  fraisActuel: number
  tauxTva: number
}

/** Recalcule moyenne achat et plancher après retrait de stock reçu (annulation achat). */
export function reverseProduitFromAchatAnnulation(input: AchatAnnulationPricingInput) {
  const prixAchatHt = reverseCmup(
    input.stockApresAnnulation,
    input.prixAchatHtActuel,
    input.quantiteRetireeStock,
    input.prixUnitaireHtRetire
  )
  const frais = reverseCmup(
    input.stockApresAnnulation,
    input.fraisActuel,
    input.quantiteRetireeStock,
    input.fraisUnitaireRetire
  )
  const prixAchatTtc = calcTtc(prixAchatHt, input.tauxTva)
  const cmupHt = calcCmupHt(prixAchatHt, frais, input.tauxTva)
  const plancher = calcPlancherFromCmup(cmupHt, input.tauxTva)

  return { prixAchatHt, prixAchatTtc, frais, plancher }
}

export function validatePrixPlancher(
  prixUnitaire: number,
  plancher: number,
  produitNom?: string
): void {
  if (prixUnitaire < plancher) {
    throw new PlancherValidationError(prixUnitaire, plancher, produitNom)
  }
}
