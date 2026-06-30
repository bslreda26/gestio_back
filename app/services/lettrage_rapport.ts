import Client from '#models/client'
import Fournisseur from '#models/fournisseur'
import Vente from '#models/vente'
import Achat from '#models/achat'
import { VENTE_STATUT } from '#constants/vente_statuts'
import { ACHAT_STATUT } from '#constants/achat_statuts'
import { buildMeta, parsePagination, type PaginationInput } from '#helpers/pagination'
import { venteTotalAPayer } from '#helpers/timbre'
import { roundMoney } from '#services/pricing_service'
import { RapportBusinessError } from '#services/rapport_service'
import { readClientSolde } from '#services/client_solde_service'
import { getFournisseurSoldePdv } from '#services/fournisseur_solde_service'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export type StatutLettrage = 'lettre' | 'partiel' | 'non_lettre'

export type LettrageDocumentLigne = {
  id: number
  type: 'facture' | 'retour' | 'achat'
  sens: 'debit' | 'credit'
  numero: string
  date: string
  montant_total: number
  montant_net: number
  montant_lettre_retour: number
  montant_lettre_reglement: number
  montant_lettre_paiement: number
  montant_lettre: number
  reste_a_payer: number
  statut_lettrage: StatutLettrage
  statut_paiement: string
  document_origine_numero: string | null
}

type LettrageDetailMontants = {
  total: number
  viaRetour: number
  viaReglement: number
}

function toSqlDate(date: DateTime) {
  return date.toISODate()!
}

function resolveStatutLettrage(montantRegle: number, resteAPayer: number): StatutLettrage {
  if (resteAPayer <= 0) return 'lettre'
  if (montantRegle <= 0) return 'non_lettre'
  return 'partiel'
}

function splitMontantsRegles(
  montantPaye: number,
  viaRetour: number,
  viaReglement: number
): {
  montant_lettre_retour: number
  montant_lettre_reglement: number
  montant_lettre_paiement: number
  montant_lettre: number
} {
  const montantLettreRetour = viaRetour
  const montantLettreReglement = viaReglement
  const montantLettrePaiement = roundMoney(
    Math.max(0, montantPaye - montantLettreRetour - montantLettreReglement)
  )

  return {
    montant_lettre_retour: montantLettreRetour,
    montant_lettre_reglement: montantLettreReglement,
    montant_lettre_paiement: montantLettrePaiement,
    montant_lettre: montantPaye,
  }
}

function assertPeriodeLettrage(dateFrom?: DateTime, dateTo?: DateTime) {
  if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) {
    throw new RapportBusinessError('date_from et date_to doivent être renseignées ensemble')
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new RapportBusinessError('date_from doit être antérieure ou égale à date_to')
  }
}

async function sumLettrageDetailParVente(clientId: number, pointDeVenteId: number) {
  const rows = await db
    .from('lettrage_lignes')
    .where('type', 'client')
    .where('client_id', clientId)
    .where('point_de_vente_id', pointDeVenteId)
    .whereNotNull('vente_id')
    .select('vente_id', 'montant', 'retour_vente_id', 'reglement_id')

  const map = new Map<number, LettrageDetailMontants>()
  for (const row of rows) {
    const venteId = Number(row.vente_id)
    const montant = roundMoney(Number(row.montant))
    const detail = map.get(venteId) ?? { total: 0, viaRetour: 0, viaReglement: 0 }
    detail.total = roundMoney(detail.total + montant)
    if (row.retour_vente_id) {
      detail.viaRetour = roundMoney(detail.viaRetour + montant)
    } else if (row.reglement_id) {
      detail.viaReglement = roundMoney(detail.viaReglement + montant)
    }
    map.set(venteId, detail)
  }
  return map
}

async function sumLettrageDetailParAchat(fournisseurId: number, pointDeVenteId: number) {
  const rows = await db
    .from('lettrage_lignes')
    .where('type', 'fournisseur')
    .where('fournisseur_id', fournisseurId)
    .where('point_de_vente_id', pointDeVenteId)
    .whereNotNull('achat_id')
    .select('achat_id', 'montant', 'retour_achat_id', 'reglement_id')

  const map = new Map<number, LettrageDetailMontants>()
  for (const row of rows) {
    const achatId = Number(row.achat_id)
    const montant = roundMoney(Number(row.montant))
    const detail = map.get(achatId) ?? { total: 0, viaRetour: 0, viaReglement: 0 }
    detail.total = roundMoney(detail.total + montant)
    if (row.retour_achat_id) {
      detail.viaRetour = roundMoney(detail.viaRetour + montant)
    } else if (row.reglement_id) {
      detail.viaReglement = roundMoney(detail.viaReglement + montant)
    }
    map.set(achatId, detail)
  }
  return map
}

function buildTotauxDocuments(documents: LettrageDocumentLigne[]) {
  const totaux = {
    nombre_documents: documents.length,
    nombre_factures: 0,
    nombre_achats: 0,
    nombre_retours: 0,
    nombre_lettre: 0,
    nombre_partiel: 0,
    nombre_non_lettre: 0,
    total_debit: 0,
    total_credit: 0,
    total_montant: 0,
    solde_net: 0,
    total_lettre: 0,
    total_lettre_retour: 0,
    total_lettre_reglement: 0,
    total_lettre_paiement: 0,
    total_reste: 0,
  }

  for (const doc of documents) {
    if (doc.type === 'retour') {
      totaux.nombre_retours += 1
      totaux.total_credit = roundMoney(totaux.total_credit + doc.montant_total)
      totaux.total_reste = roundMoney(totaux.total_reste - doc.reste_a_payer)
    } else if (doc.type === 'achat') {
      totaux.nombre_achats += 1
      totaux.total_debit = roundMoney(totaux.total_debit + doc.montant_total)
      totaux.total_reste = roundMoney(totaux.total_reste + doc.reste_a_payer)
    } else {
      totaux.nombre_factures += 1
      totaux.total_debit = roundMoney(totaux.total_debit + doc.montant_total)
      totaux.total_reste = roundMoney(totaux.total_reste + doc.reste_a_payer)
    }

    if (doc.statut_lettrage === 'lettre') totaux.nombre_lettre += 1
    else if (doc.statut_lettrage === 'partiel') totaux.nombre_partiel += 1
    else totaux.nombre_non_lettre += 1

    totaux.total_lettre = roundMoney(totaux.total_lettre + doc.montant_lettre)
    totaux.total_lettre_retour = roundMoney(totaux.total_lettre_retour + doc.montant_lettre_retour)
    totaux.total_lettre_reglement = roundMoney(
      totaux.total_lettre_reglement + doc.montant_lettre_reglement
    )
    totaux.total_lettre_paiement = roundMoney(
      totaux.total_lettre_paiement + doc.montant_lettre_paiement
    )
  }

  totaux.solde_net = roundMoney(totaux.total_debit - totaux.total_credit)
  totaux.total_montant = totaux.solde_net

  return totaux
}

export type LettrageClientReportFilters = {
  pointDeVenteId: number
  clientId: number
  dateFrom?: DateTime
  dateTo?: DateTime
  page?: number
  limit?: number
}

export async function rapportLettrageClients(filters: LettrageClientReportFilters) {
  assertPeriodeLettrage(filters.dateFrom, filters.dateTo)

  const client = await Client.query()
    .where('id', filters.clientId)
    .where('point_de_vente_id', filters.pointDeVenteId)
    .first()
  if (!client) throw new RapportBusinessError('Client introuvable')

  const { page, limit, offset } = parsePagination(filters as PaginationInput)

  const venteQuery = Vente.query()
    .where('client_id', filters.clientId)
    .where('point_de_vente_id', filters.pointDeVenteId)
    .whereIn('statut', [VENTE_STATUT.NON_VALIDE, VENTE_STATUT.VALIDE, VENTE_STATUT.RETOUR])

  if (filters.dateFrom && filters.dateTo) {
    venteQuery
      .where('date_vente', '>=', filters.dateFrom.toISODate()!)
      .where('date_vente', '<=', filters.dateTo.toISODate()!)
  }

  const [lettreParVente, totalRow, allVentes] = await Promise.all([
    sumLettrageDetailParVente(filters.clientId, filters.pointDeVenteId),
    venteQuery.clone().count('* as total'),
    venteQuery.clone().orderBy('date_vente', 'asc').orderBy('id', 'asc'),
  ])

  const origineIds = [
    ...new Set(
      allVentes
        .map((v) => v.factureOrigineId)
        .filter((id): id is number => id !== null && id !== undefined)
    ),
  ]
  const origines =
    origineIds.length > 0 ? await Vente.query().whereIn('id', origineIds).select('id', 'numero') : []
  const origineMap = new Map(origines.map((v) => [v.id, v.numero]))

  const allDocuments: LettrageDocumentLigne[] = allVentes.map((vente) => {
    const isRetour = vente.statut === VENTE_STATUT.RETOUR
    const montantTotal = venteTotalAPayer(vente)
    const reste = roundMoney(Number(vente.resteAPayer))

    if (isRetour) {
      const montantPaye = roundMoney(Number(vente.montantPaye))
      return {
        id: vente.id,
        type: 'retour',
        sens: 'credit',
        numero: vente.numero,
        date: toSqlDate(vente.dateVente),
        montant_total: montantTotal,
        montant_net: roundMoney(-montantTotal),
        montant_lettre_retour: 0,
        montant_lettre_reglement: 0,
        montant_lettre_paiement: 0,
        montant_lettre: montantPaye,
        reste_a_payer: reste,
        statut_lettrage: resolveStatutLettrage(montantPaye, reste),
        statut_paiement: vente.statutPaiement,
        document_origine_numero: vente.factureOrigineId
          ? (origineMap.get(vente.factureOrigineId) ?? null)
          : null,
      }
    }

    const detail = lettreParVente.get(vente.id) ?? { total: 0, viaRetour: 0, viaReglement: 0 }
    const montantPaye = roundMoney(Number(vente.montantPaye))
    const montants = splitMontantsRegles(montantPaye, detail.viaRetour, detail.viaReglement)

    return {
      id: vente.id,
      type: 'facture',
      sens: 'debit',
      numero: vente.numero,
      date: toSqlDate(vente.dateVente),
      montant_total: montantTotal,
      montant_net: roundMoney(montantTotal - detail.viaRetour),
      ...montants,
      reste_a_payer: reste,
      statut_lettrage: resolveStatutLettrage(montantPaye, reste),
      statut_paiement: vente.statutPaiement,
      document_origine_numero: null,
    }
  })

  const documents = allDocuments.slice(offset, offset + limit)
  const meta = buildMeta(Number(totalRow[0].$extras.total), page, limit)

  return {
    client: {
      id: client.id,
      code: client.code,
      nom: client.nom,
      solde: readClientSolde(client),
    },
    periode:
      filters.dateFrom && filters.dateTo
        ? { date_from: toSqlDate(filters.dateFrom), date_to: toSqlDate(filters.dateTo) }
        : null,
    documents,
    totaux: buildTotauxDocuments(allDocuments),
    meta,
  }
}

export type LettrageFournisseurReportFilters = {
  pointDeVenteId: number
  fournisseurId: number
  dateFrom?: DateTime
  dateTo?: DateTime
  page?: number
  limit?: number
}

export async function rapportLettrageFournisseurs(filters: LettrageFournisseurReportFilters) {
  assertPeriodeLettrage(filters.dateFrom, filters.dateTo)

  const fournisseur = await Fournisseur.query()
    .where('id', filters.fournisseurId)
    .where('is_active', true)
    .first()
  if (!fournisseur) throw new RapportBusinessError('Fournisseur introuvable')

  const { page, limit, offset } = parsePagination(filters as PaginationInput)

  const achatQuery = Achat.query()
    .where('fournisseur_id', filters.fournisseurId)
    .where('point_de_vente_id', filters.pointDeVenteId)
    .whereIn('statut', [ACHAT_STATUT.ACHAT, ACHAT_STATUT.RETOUR])

  if (filters.dateFrom && filters.dateTo) {
    achatQuery
      .where('date_achat', '>=', filters.dateFrom.toISODate()!)
      .where('date_achat', '<=', filters.dateTo.toISODate()!)
  }

  const [lettreParAchat, totalRow, allAchats, solde] = await Promise.all([
    sumLettrageDetailParAchat(filters.fournisseurId, filters.pointDeVenteId),
    achatQuery.clone().count('* as total'),
    achatQuery.clone().orderBy('date_achat', 'asc').orderBy('id', 'asc'),
    getFournisseurSoldePdv(filters.fournisseurId, filters.pointDeVenteId),
  ])

  const origineIds = [
    ...new Set(
      allAchats
        .map((a) => a.achatOrigineId)
        .filter((id): id is number => id !== null && id !== undefined)
    ),
  ]
  const origines =
    origineIds.length > 0 ? await Achat.query().whereIn('id', origineIds).select('id', 'numero') : []
  const origineMap = new Map(origines.map((a) => [a.id, a.numero]))

  const allDocuments: LettrageDocumentLigne[] = allAchats.map((achat) => {
    const isRetour = achat.statut === ACHAT_STATUT.RETOUR
    const montantTotal = roundMoney(Number(achat.totalTtc))
    const reste = roundMoney(Number(achat.resteAPayer))

    if (isRetour) {
      const montantPaye = roundMoney(Number(achat.montantPaye))
      return {
        id: achat.id,
        type: 'retour',
        sens: 'credit',
        numero: achat.numero,
        date: toSqlDate(achat.dateAchat),
        montant_total: montantTotal,
        montant_net: roundMoney(-montantTotal),
        montant_lettre_retour: 0,
        montant_lettre_reglement: 0,
        montant_lettre_paiement: 0,
        montant_lettre: montantPaye,
        reste_a_payer: reste,
        statut_lettrage: resolveStatutLettrage(montantPaye, reste),
        statut_paiement: achat.statutPaiement,
        document_origine_numero: achat.achatOrigineId
          ? (origineMap.get(achat.achatOrigineId) ?? null)
          : null,
      }
    }

    const detail = lettreParAchat.get(achat.id) ?? { total: 0, viaRetour: 0, viaReglement: 0 }
    const montantPaye = roundMoney(Number(achat.montantPaye))
    const montants = splitMontantsRegles(montantPaye, detail.viaRetour, detail.viaReglement)

    return {
      id: achat.id,
      type: 'achat',
      sens: 'debit',
      numero: achat.numero,
      date: toSqlDate(achat.dateAchat),
      montant_total: montantTotal,
      montant_net: roundMoney(montantTotal - detail.viaRetour),
      ...montants,
      reste_a_payer: reste,
      statut_lettrage: resolveStatutLettrage(montantPaye, reste),
      statut_paiement: achat.statutPaiement,
      document_origine_numero: null,
    }
  })

  const documents = allDocuments.slice(offset, offset + limit)
  const meta = buildMeta(Number(totalRow[0].$extras.total), page, limit)

  return {
    fournisseur: {
      id: fournisseur.id,
      code: fournisseur.code,
      nom: fournisseur.nom,
      solde,
    },
    periode:
      filters.dateFrom && filters.dateTo
        ? { date_from: toSqlDate(filters.dateFrom), date_to: toSqlDate(filters.dateTo) }
        : null,
    documents,
    totaux: buildTotauxDocuments(allDocuments),
    meta,
  }
}
