/** Statuts document vente / facture (valeurs stockées en base) */
export const VENTE_STATUT = {
  DEVIS: 'devis',
  VALIDE: 'valide',
  NON_VALIDE: 'non_valide',
  RETOUR: 'retour',
} as const

export type VenteStatut = (typeof VENTE_STATUT)[keyof typeof VENTE_STATUT]

/** Statuts acceptés à la création */
export const VENTE_CREATE_STATUTS = [VENTE_STATUT.DEVIS, VENTE_STATUT.NON_VALIDE] as const
export type VenteCreateStatut = (typeof VENTE_CREATE_STATUTS)[number]

export const VENTE_STATUT_LABELS: Record<VenteStatut, string> = {
  devis: 'Devis',
  valide: 'Valide',
  non_valide: 'Non valide',
  retour: 'Retour',
}

export function isDevis(statut: string): boolean {
  return statut === VENTE_STATUT.DEVIS
}

export function isFactureInvalide(statut: string): boolean {
  return statut === VENTE_STATUT.NON_VALIDE
}

export function isFactureValide(statut: string): boolean {
  return statut === VENTE_STATUT.VALIDE
}

export function isFacture(statut: string): boolean {
  return isFactureInvalide(statut) || isFactureValide(statut)
}

export function isFactureRetour(statut: string): boolean {
  return statut === VENTE_STATUT.RETOUR
}

export function isEditableVente(statut: string): boolean {
  return isDevis(statut) || isFactureInvalide(statut)
}

export function isLockableVente(statut: string): boolean {
  return (
    isDevis(statut) ||
    isFactureInvalide(statut) ||
    isFactureValide(statut) ||
    isFactureRetour(statut)
  )
}

export function isPaiementBlocked(statut: string): boolean {
  return isDevis(statut)
}

export function affectsClientSolde(statut: string): boolean {
  return isFacture(statut)
}
