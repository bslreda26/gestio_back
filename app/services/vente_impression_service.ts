import { isFacture, VENTE_STATUT, VENTE_STATUT_LABELS } from '#constants/vente_statuts'
import { loadProduitCodeMap } from '#helpers/produit_codes'
import Client from '#models/client'
import PointDeVente from '#models/point_de_vente'
import User from '#models/user'
import Vente from '#models/vente'
import VenteLigne from '#models/vente_ligne'
import { VenteBusinessError } from '#services/vente_service'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export type VenteImpressionType = 'facture' | 'bon_sortie'

export type VenteImpressionLabel = {
  impression_numero: number
  is_duplicata: boolean
  label: string
}

export type VenteImpressionLigne = {
  code: string | null
  designation: string
  modeVente: string
  quantite: number
  prixUnitaire: number
  remisePct: number
  tvaPct: number
  montantHt: number
  montantTva: number
  montantTtc: number
}

export type VenteImpressionContext = {
  type: VenteImpressionType
  impression: VenteImpressionLabel
  pointDeVente: PointDeVente
  vente: Vente
  client: Client
  vendeur: { nom: string | null; prenom: string | null; email: string } | null
  lignes: VenteImpressionLigne[]
  statutLabel: string
  documentTitle: string
  generatedAt: DateTime
}

const STATUT_PAIEMENT_LABELS: Record<string, string> = {
  non_paye: 'Non paye',
  partiel: 'Partiellement paye',
  paye: 'Paye',
}

export function statutPaiementLabel(statut: string): string {
  return STATUT_PAIEMENT_LABELS[statut] ?? statut
}

function documentTitleForVente(statut: string, type: VenteImpressionType): string {
  if (type === 'bon_sortie') return 'BON DE SORTIE'
  if (statut === VENTE_STATUT.DEVIS) return 'DEVIS'
  if (statut === VENTE_STATUT.RETOUR) return 'FACTURE RETOUR'
  return 'FACTURE'
}

function assertImpressionAllowed(vente: Vente, type: VenteImpressionType) {
  if (type === 'bon_sortie' && !isFacture(vente.statut)) {
    throw new VenteBusinessError(
      'Le bon de sortie est disponible uniquement pour une facture (non validee ou validee)'
    )
  }
}

export async function recordVenteImpression(
  venteId: number,
  type: VenteImpressionType
): Promise<VenteImpressionLabel> {
  return db.transaction(async (trx) => {
    const vente = await Vente.query({ client: trx }).where('id', venteId).forUpdate().firstOrFail()
    assertImpressionAllowed(vente, type)

    const field = type === 'facture' ? 'factureImpressionCount' : 'bonSortieImpressionCount'
    const next = Number(vente[field] ?? 0) + 1
    vente[field] = next
    vente.useTransaction(trx)
    await vente.save()

    return {
      impression_numero: next,
      is_duplicata: next > 1,
      label: next === 1 ? '1' : 'DUPLICATA',
    }
  })
}

export async function loadVenteImpressionContext(
  venteId: number,
  pointDeVenteId: number,
  type: VenteImpressionType,
  impression: VenteImpressionLabel
): Promise<VenteImpressionContext> {
  const vente = await Vente.query()
    .where('id', venteId)
    .where('point_de_vente_id', pointDeVenteId)
    .first()

  if (!vente) {
    throw new VenteBusinessError('Vente introuvable')
  }

  assertImpressionAllowed(vente, type)

  const [pointDeVente, client, user, lignesDb] = await Promise.all([
    PointDeVente.findOrFail(vente.pointDeVenteId),
    Client.findOrFail(vente.clientId),
    User.find(vente.userId),
    VenteLigne.query().where('vente_id', venteId).orderBy('id', 'asc'),
  ])

  const codes = await loadProduitCodeMap(lignesDb.map((l) => l.produitId))
  const lignes: VenteImpressionLigne[] = lignesDb.map((ligne) => ({
    code: codes.get(ligne.produitId) ?? null,
    designation: ligne.designation,
    modeVente: ligne.modeVente ?? 'piece',
    quantite: Number(ligne.quantite),
    prixUnitaire: Number(ligne.prixUnitaire),
    remisePct: Number(ligne.remisePct),
    tvaPct: Number(ligne.tvaPct),
    montantHt: Number(ligne.montantHt),
    montantTva: Number(ligne.montantTva),
    montantTtc: Number(ligne.montantTtc),
  }))

  return {
    type,
    impression,
    pointDeVente,
    vente,
    client,
    vendeur: user
      ? { nom: user.nom, prenom: user.prenom, email: user.email }
      : null,
    lignes,
    statutLabel: VENTE_STATUT_LABELS[vente.statut as keyof typeof VENTE_STATUT_LABELS] ?? vente.statut,
    documentTitle: documentTitleForVente(vente.statut, type),
    generatedAt: DateTime.now(),
  }
}
