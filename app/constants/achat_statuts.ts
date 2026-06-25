/** Statuts document achat fournisseur (valeurs stockées en base) */
export const ACHAT_STATUT = {
  COMMANDE: 'commande',
  ACHAT: 'achat',
  RETOUR: 'retour',
  ANNULE: 'annule',
} as const

export type AchatStatut = (typeof ACHAT_STATUT)[keyof typeof ACHAT_STATUT]

export const ACHAT_STATUT_LABELS: Record<AchatStatut, string> = {
  commande: 'Commande',
  achat: 'Achat',
  retour: 'Retour',
  annule: 'Annulé',
}

export function isCommande(statut: string): boolean {
  return statut === ACHAT_STATUT.COMMANDE
}

export function isAchatRecu(statut: string): boolean {
  return statut === ACHAT_STATUT.ACHAT
}

export function isAchatRetour(statut: string): boolean {
  return statut === ACHAT_STATUT.RETOUR
}

export function isEditableAchat(statut: string): boolean {
  return isCommande(statut)
}

export function canReceiveMarchandise(statut: string): boolean {
  return isCommande(statut)
}

export function canPayerAchat(statut: string): boolean {
  return isAchatRecu(statut)
}

export function canAnnulerAchat(statut: string): boolean {
  return isCommande(statut)
}
