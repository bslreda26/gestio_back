import LettrageLigne from '#models/lettrage_ligne'
import Reglement from '#models/reglement'
import Vente from '#models/vente'
import Achat from '#models/achat'
import { VENTE_STATUT } from '#constants/vente_statuts'
import { ACHAT_STATUT } from '#constants/achat_statuts'
import { venteTotalAPayer } from '#helpers/timbre'
import { roundMoney } from '#services/pricing_service'
import { syncVentePaiement } from '#services/vente_service'
import { syncAchatPaiement } from '#services/achat_service'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

export type LettrageAllocationResult = {
  vente_id: number
  numero: string
  date_vente: string
  montant_alloue: number
  reste_apres: number
  statut_paiement: string
  partiel: boolean
}

export type LettrageAllocationAchatResult = {
  achat_id: number
  numero: string
  date_achat: string
  montant_alloue: number
  reste_apres: number
  statut_paiement: string
  partiel: boolean
}

export type LettrageReglementAchatResult = {
  montant_reglement: number
  montant_credit_retour_utilise: number
  montant_lettre_reglement: number
  montant_lettre: number
  montant_non_lettre: number
  allocations: LettrageAllocationAchatResult[]
}

export type LettrageReglementResult = {
  montant_reglement: number
  montant_credit_retour_utilise: number
  montant_lettre_reglement: number
  montant_lettre: number
  montant_non_lettre: number
  allocations: LettrageAllocationResult[]
}

function toSqlDate(date: DateTime) {
  return date.toISODate()!
}

async function fetchFacturesImpayeesOrdered(
  clientId: number,
  pointDeVenteId: number,
  trx: TransactionClientContract
) {
  return Vente.query({ client: trx })
    .where('client_id', clientId)
    .where('point_de_vente_id', pointDeVenteId)
    .whereIn('statut', [VENTE_STATUT.NON_VALIDE, VENTE_STATUT.VALIDE])
    .where('reste_a_payer', '>', 0)
    .orderBy('date_vente', 'asc')
    .orderBy('id', 'asc')
    .forUpdate()
}

async function fetchRetoursOuvertsOrdered(
  clientId: number,
  pointDeVenteId: number,
  trx: TransactionClientContract
) {
  return Vente.query({ client: trx })
    .where('client_id', clientId)
    .where('point_de_vente_id', pointDeVenteId)
    .where('statut', VENTE_STATUT.RETOUR)
    .where('reste_a_payer', '>', 0)
    .orderBy('date_vente', 'asc')
    .orderBy('id', 'asc')
    .forUpdate()
}

async function allouerCreditRetourClientSurFacture(
  retour: Vente,
  facture: Vente,
  montantAlloue: number,
  trx: TransactionClientContract
): Promise<LettrageAllocationResult> {
  facture.montantPaye = String(roundMoney(Number(facture.montantPaye) + montantAlloue))
  syncVentePaiement(facture)
  facture.useTransaction(trx)
  await facture.save()

  retour.montantPaye = String(roundMoney(Number(retour.montantPaye) + montantAlloue))
  syncVentePaiement(retour)
  retour.useTransaction(trx)
  await retour.save()

  await LettrageLigne.create(
    {
      type: 'client',
      clientId: retour.clientId,
      pointDeVenteId: retour.pointDeVenteId,
      venteId: facture.id,
      reglementId: null,
      retourVenteId: retour.id,
      montant: String(montantAlloue),
    },
    { client: trx }
  )

  return {
    vente_id: facture.id,
    numero: facture.numero,
    date_vente: toSqlDate(facture.dateVente),
    montant_alloue: montantAlloue,
    reste_apres: roundMoney(Number(facture.resteAPayer)),
    statut_paiement: facture.statutPaiement,
    partiel: Number(facture.resteAPayer) > 0,
  }
}

/** Consomme les crédits avoir (retours) ouverts sur les factures impayées — FIFO. */
async function consommerCreditsRetourSurFactures(
  retours: Vente[],
  factures: Vente[],
  trx: TransactionClientContract
): Promise<{ allocations: LettrageAllocationResult[]; montantUtilise: number }> {
  const allocations: LettrageAllocationResult[] = []
  let montantUtilise = 0

  for (const facture of factures) {
    for (const retour of retours) {
      const creditRetour = roundMoney(Number(retour.resteAPayer))
      if (creditRetour <= 0) continue

      const resteFacture = roundMoney(Number(facture.resteAPayer))
      if (resteFacture <= 0) continue

      const montantAlloue = roundMoney(Math.min(creditRetour, resteFacture))
      if (montantAlloue <= 0) continue

      allocations.push(
        await allouerCreditRetourClientSurFacture(retour, facture, montantAlloue, trx)
      )
      montantUtilise = roundMoney(montantUtilise + montantAlloue)
    }
  }

  return { allocations, montantUtilise }
}

async function allouerSurFacturesFifo(
  montantDisponible: number,
  factures: Vente[],
  params: {
    clientId: number
    pointDeVenteId: number
    reglementId?: number | null
    retourVenteId?: number | null
    trx: TransactionClientContract
  }
): Promise<{ allocations: LettrageAllocationResult[]; montantRestant: number }> {
  let reste = roundMoney(montantDisponible)
  const allocations: LettrageAllocationResult[] = []

  for (const facture of factures) {
    if (reste <= 0) break

    const resteFacture = roundMoney(Number(facture.resteAPayer))
    if (resteFacture <= 0) continue

    const montantAlloue = roundMoney(Math.min(reste, resteFacture))
    if (montantAlloue <= 0) continue

    facture.montantPaye = String(roundMoney(Number(facture.montantPaye) + montantAlloue))
    syncVentePaiement(facture)
    facture.useTransaction(params.trx)
    await facture.save()

    await LettrageLigne.create(
      {
        type: 'client',
        clientId: params.clientId,
        pointDeVenteId: params.pointDeVenteId,
        venteId: facture.id,
        reglementId: params.reglementId ?? null,
        retourVenteId: params.retourVenteId ?? null,
        montant: String(montantAlloue),
      },
      { client: params.trx }
    )

    allocations.push({
      vente_id: facture.id,
      numero: facture.numero,
      date_vente: toSqlDate(facture.dateVente),
      montant_alloue: montantAlloue,
      reste_apres: roundMoney(Number(facture.resteAPayer)),
      statut_paiement: facture.statutPaiement,
      partiel: Number(facture.resteAPayer) > 0,
    })

    reste = roundMoney(reste - montantAlloue)
  }

  return { allocations, montantRestant: reste }
}

/**
 * Lettrage FIFO d'un règlement client autonome (sans vente_id) sur les factures impayées.
 * Les paiements directs sur facture ne passent pas par ici.
 */
export async function appliquerLettrageReglementClient(
  reglement: Reglement,
  trx: TransactionClientContract
): Promise<LettrageReglementResult> {
  const montantReglement = roundMoney(Number(reglement.montant))

  if (montantReglement <= 0 || reglement.venteId || reglement.paiementId || !reglement.clientId) {
    return {
      montant_reglement: montantReglement,
      montant_credit_retour_utilise: 0,
      montant_lettre_reglement: 0,
      montant_lettre: 0,
      montant_non_lettre: montantReglement,
      allocations: [],
    }
  }

  const [factures, retours] = await Promise.all([
    fetchFacturesImpayeesOrdered(reglement.clientId, reglement.pointDeVenteId, trx),
    fetchRetoursOuvertsOrdered(reglement.clientId, reglement.pointDeVenteId, trx),
  ])

  const { allocations: allocationsRetour, montantUtilise: montantCreditRetourUtilise } =
    await consommerCreditsRetourSurFactures(retours, factures, trx)

  const { allocations: allocationsReglement, montantRestant } = await allouerSurFacturesFifo(
    montantReglement,
    factures,
    {
      clientId: reglement.clientId,
      pointDeVenteId: reglement.pointDeVenteId,
      reglementId: reglement.id,
      trx,
    }
  )

  const montantLettreReglement = roundMoney(montantReglement - montantRestant)

  return {
    montant_reglement: montantReglement,
    montant_credit_retour_utilise: montantCreditRetourUtilise,
    montant_lettre_reglement: montantLettreReglement,
    montant_lettre: roundMoney(montantCreditRetourUtilise + montantLettreReglement),
    montant_non_lettre: montantRestant,
    allocations: [...allocationsRetour, ...allocationsReglement],
  }
}

/**
 * Lettrage d'un avoir (retour) sur les factures impayées les plus anciennes.
 */
export async function appliquerLettrageRetour(
  retour: Vente,
  trx: TransactionClientContract
): Promise<LettrageReglementResult> {
  const creditDisponible = roundMoney(Number(retour.resteAPayer))

  if (retour.statut !== VENTE_STATUT.RETOUR || creditDisponible <= 0) {
    return {
      montant_reglement: creditDisponible,
      montant_credit_retour_utilise: 0,
      montant_lettre_reglement: 0,
      montant_lettre: 0,
      montant_non_lettre: creditDisponible,
      allocations: [],
    }
  }

  const factures = await fetchFacturesImpayeesOrdered(retour.clientId, retour.pointDeVenteId, trx)

  const { allocations, montantUtilise } = await consommerCreditsRetourSurFactures(
    [retour],
    factures,
    trx
  )

  const montantLettre = roundMoney(montantUtilise)
  const resteCredit = roundMoney(creditDisponible - montantLettre)

  return {
    montant_reglement: creditDisponible,
    montant_credit_retour_utilise: montantLettre,
    montant_lettre_reglement: 0,
    montant_lettre: montantLettre,
    montant_non_lettre: resteCredit,
    allocations,
  }
}

function serializeVenteOuverte(vente: Vente, type: 'facture' | 'retour') {
  return {
    id: vente.id,
    numero: vente.numero,
    type,
    date_vente: toSqlDate(vente.dateVente),
    total_a_payer: venteTotalAPayer(vente),
    montant_paye: roundMoney(Number(vente.montantPaye)),
    reste_a_payer: roundMoney(Number(vente.resteAPayer)),
    statut_paiement: vente.statutPaiement,
    facture_origine_id: vente.factureOrigineId,
  }
}

export async function listerDocumentsOuvertsClient(
  clientId: number,
  pointDeVenteId: number
) {
  const [factures, retours] = await Promise.all([
    Vente.query()
      .where('client_id', clientId)
      .where('point_de_vente_id', pointDeVenteId)
      .whereIn('statut', [VENTE_STATUT.NON_VALIDE, VENTE_STATUT.VALIDE])
      .where('reste_a_payer', '>', 0)
      .orderBy('date_vente', 'asc')
      .orderBy('id', 'asc'),
    Vente.query()
      .where('client_id', clientId)
      .where('point_de_vente_id', pointDeVenteId)
      .where('statut', VENTE_STATUT.RETOUR)
      .where('reste_a_payer', '>', 0)
      .orderBy('date_vente', 'asc')
      .orderBy('id', 'asc'),
  ])

  return {
    factures_restantes: factures.map((v) => serializeVenteOuverte(v, 'facture')),
    retours_restants: retours.map((v) => serializeVenteOuverte(v, 'retour')),
    total_creances: roundMoney(factures.reduce((s, v) => s + Number(v.resteAPayer), 0)),
    total_credits_retour: roundMoney(retours.reduce((s, v) => s + Number(v.resteAPayer), 0)),
  }
}

export async function getLettrageLignesReglement(reglementId: number) {
  const reglement = await Reglement.find(reglementId)
  if (!reglement) return []

  const lignes = await LettrageLigne.query()
    .where('reglement_id', reglementId)
    .orderBy('id', 'asc')

  if (lignes.length === 0) return []

  if (reglement.type === 'fournisseur') {
    const achatIds = lignes.map((l) => l.achatId).filter((id): id is number => id !== null)
    const achats = achatIds.length > 0 ? await Achat.query().whereIn('id', achatIds) : []
    const achatMap = new Map(achats.map((a) => [a.id, a]))

    return lignes.map((ligne) => {
      const achat = achatMap.get(ligne.achatId!)!
      return {
        achat_id: ligne.achatId,
        numero: achat.numero,
        date_achat: toSqlDate(achat.dateAchat),
        montant_alloue: roundMoney(Number(ligne.montant)),
        reste_apres: roundMoney(Number(achat.resteAPayer)),
        statut_paiement: achat.statutPaiement,
      }
    })
  }

  const venteIds = lignes.map((l) => l.venteId).filter((id): id is number => id !== null)
  const ventes = venteIds.length > 0 ? await Vente.query().whereIn('id', venteIds) : []
  const venteMap = new Map(ventes.map((v) => [v.id, v]))

  return lignes.map((ligne) => {
    const vente = venteMap.get(ligne.venteId!)!
    return {
      vente_id: ligne.venteId,
      numero: vente.numero,
      date_vente: toSqlDate(vente.dateVente),
      montant_alloue: roundMoney(Number(ligne.montant)),
      reste_apres: roundMoney(Number(vente.resteAPayer)),
      statut_paiement: vente.statutPaiement,
    }
  })
}

// ── Fournisseur ───────────────────────────────────────────────────────────────

async function fetchAchatsImpayesOrdered(
  fournisseurId: number,
  pointDeVenteId: number,
  trx: TransactionClientContract
) {
  return Achat.query({ client: trx })
    .where('fournisseur_id', fournisseurId)
    .where('point_de_vente_id', pointDeVenteId)
    .where('statut', ACHAT_STATUT.ACHAT)
    .where('reste_a_payer', '>', 0)
    .orderBy('date_achat', 'asc')
    .orderBy('id', 'asc')
    .forUpdate()
}

async function fetchRetoursAchatOuvertsOrdered(
  fournisseurId: number,
  pointDeVenteId: number,
  trx: TransactionClientContract
) {
  return Achat.query({ client: trx })
    .where('fournisseur_id', fournisseurId)
    .where('point_de_vente_id', pointDeVenteId)
    .where('statut', ACHAT_STATUT.RETOUR)
    .where('reste_a_payer', '>', 0)
    .orderBy('date_achat', 'asc')
    .orderBy('id', 'asc')
    .forUpdate()
}

async function allouerCreditRetourFournisseurSurAchat(
  retour: Achat,
  achat: Achat,
  montantAlloue: number,
  trx: TransactionClientContract
): Promise<LettrageAllocationAchatResult> {
  achat.montantPaye = String(roundMoney(Number(achat.montantPaye) + montantAlloue))
  achat.resteAPayer = String(
    roundMoney(Math.max(0, Number(achat.resteAPayer) - montantAlloue))
  )
  syncAchatPaiement(achat)
  achat.useTransaction(trx)
  await achat.save()

  retour.montantPaye = String(roundMoney(Number(retour.montantPaye) + montantAlloue))
  retour.resteAPayer = String(roundMoney(Math.max(0, Number(retour.resteAPayer) - montantAlloue)))
  syncAchatPaiement(retour)
  retour.useTransaction(trx)
  await retour.save()

  await LettrageLigne.create(
    {
      type: 'fournisseur',
      fournisseurId: retour.fournisseurId,
      pointDeVenteId: retour.pointDeVenteId,
      achatId: achat.id,
      reglementId: null,
      retourAchatId: retour.id,
      montant: String(montantAlloue),
    },
    { client: trx }
  )

  return {
    achat_id: achat.id,
    numero: achat.numero,
    date_achat: toSqlDate(achat.dateAchat),
    montant_alloue: montantAlloue,
    reste_apres: roundMoney(Number(achat.resteAPayer)),
    statut_paiement: achat.statutPaiement,
    partiel: Number(achat.resteAPayer) > 0,
  }
}

async function consommerCreditsRetourSurAchats(
  retours: Achat[],
  achats: Achat[],
  trx: TransactionClientContract
): Promise<{ allocations: LettrageAllocationAchatResult[]; montantUtilise: number }> {
  const allocations: LettrageAllocationAchatResult[] = []
  let montantUtilise = 0

  for (const achat of achats) {
    for (const retour of retours) {
      const creditRetour = roundMoney(Number(retour.resteAPayer))
      if (creditRetour <= 0) continue

      const resteAchat = roundMoney(Number(achat.resteAPayer))
      if (resteAchat <= 0) continue

      const montantAlloue = roundMoney(Math.min(creditRetour, resteAchat))
      if (montantAlloue <= 0) continue

      allocations.push(
        await allouerCreditRetourFournisseurSurAchat(retour, achat, montantAlloue, trx)
      )
      montantUtilise = roundMoney(montantUtilise + montantAlloue)
    }
  }

  return { allocations, montantUtilise }
}

async function allouerSurAchatsFifo(
  montantDisponible: number,
  achats: Achat[],
  params: {
    fournisseurId: number
    pointDeVenteId: number
    reglementId?: number | null
    retourAchatId?: number | null
    trx: TransactionClientContract
  }
): Promise<{ allocations: LettrageAllocationAchatResult[]; montantRestant: number }> {
  let reste = roundMoney(montantDisponible)
  const allocations: LettrageAllocationAchatResult[] = []

  for (const achat of achats) {
    if (reste <= 0) break

    const resteAchat = roundMoney(Number(achat.resteAPayer))
    if (resteAchat <= 0) continue

    const montantAlloue = roundMoney(Math.min(reste, resteAchat))
    if (montantAlloue <= 0) continue

    achat.montantPaye = String(roundMoney(Number(achat.montantPaye) + montantAlloue))
    achat.resteAPayer = String(roundMoney(Math.max(0, resteAchat - montantAlloue)))
    syncAchatPaiement(achat)
    achat.useTransaction(params.trx)
    await achat.save()

    await LettrageLigne.create(
      {
        type: 'fournisseur',
        fournisseurId: params.fournisseurId,
        pointDeVenteId: params.pointDeVenteId,
        achatId: achat.id,
        reglementId: params.reglementId ?? null,
        retourAchatId: params.retourAchatId ?? null,
        montant: String(montantAlloue),
      },
      { client: params.trx }
    )

    allocations.push({
      achat_id: achat.id,
      numero: achat.numero,
      date_achat: toSqlDate(achat.dateAchat),
      montant_alloue: montantAlloue,
      reste_apres: roundMoney(Number(achat.resteAPayer)),
      statut_paiement: achat.statutPaiement,
      partiel: Number(achat.resteAPayer) > 0,
    })

    reste = roundMoney(reste - montantAlloue)
  }

  return { allocations, montantRestant: reste }
}

export async function appliquerLettrageReglementFournisseur(
  reglement: Reglement,
  trx: TransactionClientContract
): Promise<LettrageReglementAchatResult> {
  const montantReglement = roundMoney(Number(reglement.montant))

  if (
    montantReglement <= 0 ||
    reglement.type !== 'fournisseur' ||
    !reglement.fournisseurId
  ) {
    return {
      montant_reglement: montantReglement,
      montant_credit_retour_utilise: 0,
      montant_lettre_reglement: 0,
      montant_lettre: 0,
      montant_non_lettre: montantReglement,
      allocations: [],
    }
  }

  const [achats, retours] = await Promise.all([
    fetchAchatsImpayesOrdered(reglement.fournisseurId, reglement.pointDeVenteId, trx),
    fetchRetoursAchatOuvertsOrdered(reglement.fournisseurId, reglement.pointDeVenteId, trx),
  ])

  const { allocations: allocationsRetour, montantUtilise: montantCreditRetourUtilise } =
    await consommerCreditsRetourSurAchats(retours, achats, trx)

  const { allocations: allocationsReglement, montantRestant } = await allouerSurAchatsFifo(
    montantReglement,
    achats,
    {
      fournisseurId: reglement.fournisseurId,
      pointDeVenteId: reglement.pointDeVenteId,
      reglementId: reglement.id,
      trx,
    }
  )

  const montantLettreReglement = roundMoney(montantReglement - montantRestant)

  return {
    montant_reglement: montantReglement,
    montant_credit_retour_utilise: montantCreditRetourUtilise,
    montant_lettre_reglement: montantLettreReglement,
    montant_lettre: roundMoney(montantCreditRetourUtilise + montantLettreReglement),
    montant_non_lettre: montantRestant,
    allocations: [...allocationsRetour, ...allocationsReglement],
  }
}

export async function appliquerLettrageRetourAchat(
  retour: Achat,
  trx: TransactionClientContract
): Promise<LettrageReglementAchatResult> {
  const creditDisponible = roundMoney(Number(retour.resteAPayer))

  if (retour.statut !== ACHAT_STATUT.RETOUR || creditDisponible <= 0) {
    return {
      montant_reglement: creditDisponible,
      montant_credit_retour_utilise: 0,
      montant_lettre_reglement: 0,
      montant_lettre: 0,
      montant_non_lettre: creditDisponible,
      allocations: [],
    }
  }

  const achats = await fetchAchatsImpayesOrdered(
    retour.fournisseurId,
    retour.pointDeVenteId,
    trx
  )

  const { allocations, montantUtilise } = await consommerCreditsRetourSurAchats(
    [retour],
    achats,
    trx
  )

  const montantLettre = roundMoney(montantUtilise)
  const resteCredit = roundMoney(creditDisponible - montantLettre)

  return {
    montant_reglement: creditDisponible,
    montant_credit_retour_utilise: montantLettre,
    montant_lettre_reglement: 0,
    montant_lettre: montantLettre,
    montant_non_lettre: resteCredit,
    allocations,
  }
}

export {
  rapportLettrageClients,
  rapportLettrageFournisseurs,
  type LettrageClientReportFilters,
  type LettrageFournisseurReportFilters,
  type LettrageDocumentLigne,
  type StatutLettrage,
} from '#services/lettrage_rapport'

/** Reconstitue le lettrage historique pour les règlements autonomes clients. */
export async function backfillLettrageClients() {
  const reglements = await Reglement.query()
    .where('type', 'client')
    .whereNull('vente_id')
    .whereNull('paiement_id')
    .where('montant', '>', 0)
    .whereNotExists((sub) => {
      sub.from('lettrage_lignes').whereRaw('lettrage_lignes.reglement_id = reglements.id')
    })
    .orderBy('date_reglement', 'asc')
    .orderBy('id', 'asc')

  for (const reglement of reglements) {
    await Reglement.transaction(async (trx) => {
      const locked = await Reglement.query({ client: trx })
        .where('id', reglement.id)
        .forUpdate()
        .firstOrFail()
      await appliquerLettrageReglementClient(locked, trx)
    })
  }
}

export async function backfillLettrageFournisseurs() {
  const reglements = await Reglement.query()
    .where('type', 'fournisseur')
    .where('montant', '>', 0)
    .whereNotExists((sub) => {
      sub.from('lettrage_lignes').whereRaw('lettrage_lignes.reglement_id = reglements.id')
    })
    .orderBy('date_reglement', 'asc')
    .orderBy('id', 'asc')

  for (const reglement of reglements) {
    await Reglement.transaction(async (trx) => {
      const locked = await Reglement.query({ client: trx })
        .where('id', reglement.id)
        .forUpdate()
        .firstOrFail()
      await appliquerLettrageReglementFournisseur(locked, trx)
    })
  }
}

/**
 * Annule le lettrage appliqué automatiquement à la création d'un retour
 * (lignes sans règlement associé). Le lettrage ne doit se faire qu'au règlement.
 */
export async function annulerLettrageAutoSurRetours() {
  const lignes = await LettrageLigne.query()
    .whereNull('reglement_id')
    .where((q) => {
      q.whereNotNull('retour_vente_id').orWhereNotNull('retour_achat_id')
    })

  if (lignes.length === 0) return { lignes_annulees: 0 }

  await LettrageLigne.transaction(async (trx) => {
    for (const ligne of lignes) {
      const montant = roundMoney(Number(ligne.montant))

      if (ligne.venteId) {
        const vente = await Vente.query({ client: trx }).where('id', ligne.venteId).forUpdate().first()
        if (vente) {
          vente.montantPaye = String(roundMoney(Math.max(0, Number(vente.montantPaye) - montant)))
          vente.resteAPayer = String(roundMoney(Number(vente.resteAPayer) + montant))
          syncVentePaiement(vente)
          vente.useTransaction(trx)
          await vente.save()
        }
      }

      if (ligne.retourVenteId) {
        const retour = await Vente.query({ client: trx })
          .where('id', ligne.retourVenteId)
          .forUpdate()
          .first()
        if (retour) {
          retour.montantPaye = String(roundMoney(Math.max(0, Number(retour.montantPaye) - montant)))
          retour.resteAPayer = String(roundMoney(Number(retour.resteAPayer) + montant))
          syncVentePaiement(retour)
          retour.useTransaction(trx)
          await retour.save()
        }
      }

      if (ligne.achatId) {
        const achat = await Achat.query({ client: trx }).where('id', ligne.achatId).forUpdate().first()
        if (achat) {
          achat.montantPaye = String(roundMoney(Math.max(0, Number(achat.montantPaye) - montant)))
          achat.resteAPayer = String(roundMoney(Number(achat.resteAPayer) + montant))
          syncAchatPaiement(achat)
          achat.useTransaction(trx)
          await achat.save()
        }
      }

      if (ligne.retourAchatId) {
        const retour = await Achat.query({ client: trx })
          .where('id', ligne.retourAchatId)
          .forUpdate()
          .first()
        if (retour) {
          retour.montantPaye = String(roundMoney(Math.max(0, Number(retour.montantPaye) - montant)))
          retour.resteAPayer = String(roundMoney(Math.max(0, Number(retour.resteAPayer) + montant)))
          syncAchatPaiement(retour)
          retour.useTransaction(trx)
          await retour.save()
        }
      }

      ligne.useTransaction(trx)
      await ligne.delete()
    }
  })

  return { lignes_annulees: lignes.length }
}
