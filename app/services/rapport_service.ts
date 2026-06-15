import Client from '#models/client'
import Produit from '#models/produit'
import Vente from '#models/vente'
import Paiement from '#models/paiement'
import Reglement from '#models/reglement'
import CaisseMouvement from '#models/caisse_mouvement'
import { buildMeta, parsePagination, type PaginationInput } from '#helpers/pagination'
import { applyStockAlertFilter, getStockStatus } from '#helpers/produit_query'
import { roundMoney } from '#services/pricing_service'
import { resolveStockDisplay } from '#services/vente_unite_service'
import { getSolde } from '#services/caisse_service'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export class RapportBusinessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RapportBusinessError'
  }
}

function toSqlDate(date: DateTime) {
  return date.toISODate()!
}

function toSqlDateTimeEnd(date: DateTime) {
  return date.endOf('day').toSQL()!
}

function toSqlDateTimeStart(date: DateTime) {
  return date.startOf('day').toSQL()!
}

async function soldeCaisseAt(caisseId: number, date: DateTime, position: 'debut' | 'fin') {
  if (position === 'debut') {
    const lastBefore = await CaisseMouvement.query()
      .where('caisse_id', caisseId)
      .where('date_mouvement', '<', toSqlDateTimeStart(date))
      .orderBy('date_mouvement', 'desc')
      .orderBy('id', 'desc')
      .first()

    return lastBefore ? roundMoney(Number(lastBefore.soldeApres)) : 0
  }

  const lastAtOrBefore = await CaisseMouvement.query()
    .where('caisse_id', caisseId)
    .where('date_mouvement', '<=', toSqlDateTimeEnd(date))
    .orderBy('date_mouvement', 'desc')
    .orderBy('id', 'desc')
    .first()

  if (lastAtOrBefore) {
    return roundMoney(Number(lastAtOrBefore.soldeApres))
  }

  return soldeCaisseAt(caisseId, date, 'debut')
}

export async function rapportCaisse(
  pointDeVenteId: number,
  dateFrom: DateTime,
  dateTo: DateTime,
  caisseId?: number,
  pagination: PaginationInput = {}
) {
  if (dateFrom > dateTo) {
    throw new RapportBusinessError('date_from doit être antérieure ou égale à date_to')
  }

  const { page, limit, offset } = parsePagination(pagination)
  const caisse = await getSolde(pointDeVenteId, caisseId)

  const periodFilter = (query: ReturnType<typeof db.from>) =>
    query
      .where('caisse_id', caisse.caisseId)
      .where('date_mouvement', '>=', toSqlDateTimeStart(dateFrom))
      .where('date_mouvement', '<=', toSqlDateTimeEnd(dateTo))

  const mouvementQuery = () =>
    CaisseMouvement.query()
      .where('caisse_id', caisse.caisseId)
      .where('date_mouvement', '>=', toSqlDateTimeStart(dateFrom))
      .where('date_mouvement', '<=', toSqlDateTimeEnd(dateTo))

  const [soldeInitial, totalsRow, countRow, mouvements] = await Promise.all([
    soldeCaisseAt(caisse.caisseId, dateFrom, 'debut'),
    periodFilter(db.from('caisse_mouvements'))
      .select(
        db.raw("COALESCE(SUM(CASE WHEN type = 'entree' THEN montant ELSE 0 END), 0) as total_credit"),
        db.raw("COALESCE(SUM(CASE WHEN type = 'sortie' THEN montant ELSE 0 END), 0) as total_debit")
      )
      .first(),
    mouvementQuery().count('* as total'),
    mouvementQuery().orderBy('date_mouvement', 'asc').orderBy('id', 'asc').offset(offset).limit(limit),
  ])

  const totalCredit = roundMoney(Number(totalsRow?.total_credit ?? 0))
  const totalDebit = roundMoney(Number(totalsRow?.total_debit ?? 0))
  const soldeFinal = roundMoney(soldeInitial + totalCredit - totalDebit)
  const totalMouvements = Number(countRow[0].$extras.total)
  const meta = buildMeta(totalMouvements, page, limit)

  type Ligne = {
    date: string
    designation: string
    credit: number
    debit: number
    solde: number
  }

  const lignes: Ligne[] = []

  if (page === 1) {
    lignes.push({
      date: toSqlDate(dateFrom),
      designation: 'Solde initial',
      credit: 0,
      debit: 0,
      solde: soldeInitial,
    })
  }

  for (const m of mouvements) {
    const credit = m.type === 'entree' ? Number(m.montant) : 0
    const debit = m.type === 'sortie' ? Number(m.montant) : 0
    lignes.push({
      date: toSqlDate(m.dateMouvement),
      designation: m.libelle,
      credit: roundMoney(credit),
      debit: roundMoney(debit),
      solde: roundMoney(Number(m.soldeApres)),
    })
  }

  if (page === meta.lastPage) {
    lignes.push({
      date: toSqlDate(dateTo),
      designation: 'Solde final',
      credit: 0,
      debit: 0,
      solde: soldeFinal,
    })
  }

  return {
    periode: { dateFrom: toSqlDate(dateFrom), dateTo: toSqlDate(dateTo) },
    caisse: { id: caisse.caisseId, nom: caisse.nom },
    totaux: {
      soldeInitial,
      totalCredit,
      totalDebit,
      soldeFinal,
    },
    lignes,
    meta,
  }
}

export async function rapportStockActuel(filters: {
  pointDeVenteId: number
  page?: number
  limit?: number
  categorieId?: number
  stockAlert?: 'rupture' | 'alerte' | 'normal' | 'surstock'
  search?: string
  isActive?: boolean
}) {
  const { page, limit, offset } = parsePagination(filters)

  const query = Produit.query()
    .where('point_de_vente_id', filters.pointDeVenteId)
    .orderBy('nom', 'asc')
  if (filters.categorieId) query.where('categorie_id', filters.categorieId)
  if (filters.isActive !== undefined) query.where('is_active', filters.isActive)
  if (filters.stockAlert) applyStockAlertFilter(query, filters.stockAlert)
  if (filters.search) {
    const term = `%${filters.search}%`
    query.where((q) => q.whereILike('nom', term).orWhereILike('code', term))
  }

  const total = await query.clone().count('* as total')
  const produits = await query.offset(offset).limit(limit)

  const lignes = produits.map((p) => {
    const qty = Number(p.stockActuel)
    const plancher = Number(p.plancher)
    const stockDisplay = resolveStockDisplay(p, qty)
    return {
      id: p.id,
      code: p.code,
      nom: p.nom,
      categorieId: p.categorieId,
      stockActuel: stockDisplay.stockDetail,
      stockPieces: stockDisplay.stockPieces,
      stockResteDetail: stockDisplay.stockResteDetail,
      stockLabel: stockDisplay.stockLabel,
      venteAuDetail: stockDisplay.venteAuDetail,
      stockMinimum: Number(p.stockMinimum),
      stockMaximum: Number(p.stockMaximum),
      plancher,
      valeurPlancher: roundMoney(plancher * qty),
      stockStatus: getStockStatus(qty, Number(p.stockMinimum), Number(p.stockMaximum)),
      isActive: p.isActive,
    }
  })

  const valeurTotale = roundMoney(lignes.reduce((s, l) => s + l.valeurPlancher, 0))

  return {
    lignes,
    meta: buildMeta(Number(total[0].$extras.total), page, limit),
    totaux: {
      nombreProduits: Number(total[0].$extras.total),
      valeurPlancherPage: valeurTotale,
    },
  }
}

export async function rapportValeurStock(
  pointDeVenteId: number,
  categorieId?: number,
  pagination: PaginationInput = {}
) {
  const { page, limit, offset } = parsePagination(pagination)

  const baseFilter = (query: ReturnType<typeof db.from>) => {
    query.where('point_de_vente_id', pointDeVenteId).where('is_active', true)
    if (categorieId) query.where('categorie_id', categorieId)
    return query
  }

  const produitQuery = Produit.query()
    .where('point_de_vente_id', pointDeVenteId)
    .where('is_active', true)
    .orderBy('nom', 'asc')
  if (categorieId) produitQuery.where('categorie_id', categorieId)

  const [countRow, totalsRow, produits] = await Promise.all([
    produitQuery.clone().count('* as total'),
    baseFilter(db.from('produits'))
      .select(db.raw('COALESCE(SUM(plancher * stock_actuel), 0) as valeur_globale'))
      .first(),
    produitQuery.offset(offset).limit(limit),
  ])

  const totalArticles = Number(countRow[0].$extras.total)
  const meta = buildMeta(totalArticles, page, limit)

  const lignes = produits.map((p) => {
    const plancher = Number(p.plancher)
    const quantiteStock = Number(p.stockActuel)
    const stockDisplay = resolveStockDisplay(p, quantiteStock)
    return {
      designation: p.nom,
      plancher,
      quantite: stockDisplay.stockLabel,
      quantiteStock,
      stockPieces: stockDisplay.stockPieces,
      stockResteDetail: stockDisplay.stockResteDetail,
      valeurGlobale: roundMoney(plancher * quantiteStock),
    }
  })

  return {
    formule: 'valeur globale = plancher × quantité (stock interne)',
    totaux: {
      nombreArticles: totalArticles,
      valeurGlobale: roundMoney(Number(totalsRow?.valeur_globale ?? 0)),
    },
    lignes,
    meta,
  }
}

function clientReportQuery(filters: {
  pointDeVenteId: number
  clientId?: number
  search?: string
}) {
  const query = Client.query()
    .where('is_active', true)
    .where('point_de_vente_id', filters.pointDeVenteId)
  if (filters.clientId) query.where('id', filters.clientId)
  if (filters.search) {
    const term = `%${filters.search}%`
    query.where((q) =>
      q.whereILike('nom', term).orWhereILike('code', term).orWhereILike('telephone', term)
    )
  }
  return query
}

export async function rapportBalanceClients(filters: {
  pointDeVenteId: number
  page?: number
  limit?: number
  clientId?: number
  search?: string
}) {
  const { page, limit, offset } = parsePagination(filters)

  const clientQuery = clientReportQuery(filters).orderBy('nom', 'asc')

  const clientSumQuery = () => {
    let query = db
      .from('clients')
      .where('is_active', true)
      .where('point_de_vente_id', filters.pointDeVenteId)
    if (filters.clientId) query = query.where('id', filters.clientId)
    if (filters.search) {
      const term = `%${filters.search}%`
      query = query.where((q) =>
        q.whereILike('nom', term).orWhereILike('code', term).orWhereILike('telephone', term)
      )
    }
    return query
  }

  const [countRow, totalsRow, clients] = await Promise.all([
    clientQuery.clone().count('* as total'),
    clientSumQuery().sum('solde as total_solde'),
    clientQuery.offset(offset).limit(limit),
  ])

  const totalClients = Number(countRow[0].$extras.total)
  const meta = buildMeta(totalClients, page, limit)

  const lignes = clients.map((c) => ({
    reference: c.code,
    designation: c.nom,
    solde: roundMoney(Number(c.solde)),
  }))

  return {
    lignes,
    meta,
    totaux: {
      nombreClients: totalClients,
      totalSoldeClients: roundMoney(Number(totalsRow[0]?.total_solde ?? 0)),
    },
  }
}

type ClientReleveOperation = {
  sortKey: string
  date: string
  reference: string
  designation: string
  debit: number
  credit: number
}

function applyClientReleveDateFilter(
  query: ReturnType<typeof db.from>,
  column: string,
  dateFrom: DateTime,
  dateTo?: DateTime
) {
  query.where(column, '>=', toSqlDate(dateFrom))
  if (dateTo) query.where(column, '<=', toSqlDate(dateTo))
  return query
}

async function clientSoldeNetChange(
  clientId: number,
  pointDeVenteId: number,
  dateFrom: DateTime,
  dateTo?: DateTime
) {
  const venteBase = () =>
    db.from('ventes').where('client_id', clientId).where('point_de_vente_id', pointDeVenteId)

  const [facturesRow, retoursRow, paiementsRow, reglementsRow] = await Promise.all([
    applyClientReleveDateFilter(
      venteBase().whereIn('statut', ['non_valide', 'valide']),
      'date_vente',
      dateFrom,
      dateTo
    ).sum('total_ttc as total'),
    applyClientReleveDateFilter(
      venteBase().where('statut', 'retour'),
      'date_vente',
      dateFrom,
      dateTo
    ).sum('total_ttc as total'),
    applyClientReleveDateFilter(
      db
        .from('paiements')
        .join('ventes', 'paiements.reference_id', 'ventes.id')
        .where('paiements.type', 'vente')
        .where('ventes.client_id', clientId)
        .where('ventes.point_de_vente_id', pointDeVenteId),
      'paiements.date_paiement',
      dateFrom,
      dateTo
    ).sum('paiements.montant as total'),
    applyClientReleveDateFilter(
      db
        .from('reglements')
        .where('type', 'client')
        .where('client_id', clientId)
        .where('point_de_vente_id', pointDeVenteId),
      'date_reglement',
      dateFrom,
      dateTo
    )
      .select(
        db.raw('COALESCE(SUM(CASE WHEN montant > 0 THEN montant ELSE 0 END), 0) as total_credit'),
        db.raw('COALESCE(SUM(CASE WHEN montant < 0 THEN ABS(montant) ELSE 0 END), 0) as total_debit')
      )
      .first(),
  ])

  const totalDebit = roundMoney(
    Number(facturesRow[0]?.total ?? 0) + Number(reglementsRow?.total_debit ?? 0)
  )
  const totalCredit = roundMoney(
    Number(retoursRow[0]?.total ?? 0) +
      Number(paiementsRow[0]?.total ?? 0) +
      Number(reglementsRow?.total_credit ?? 0)
  )

  return { totalDebit, totalCredit }
}

async function buildClientReleveOperations(
  clientId: number,
  pointDeVenteId: number,
  dateFrom: DateTime,
  dateTo: DateTime
) {
  const from = toSqlDate(dateFrom)
  const to = toSqlDate(dateTo)

  const [ventes, paiements, reglements] = await Promise.all([
    Vente.query()
      .where('client_id', clientId)
      .where('point_de_vente_id', pointDeVenteId)
      .whereIn('statut', ['non_valide', 'valide', 'retour'])
      .where('date_vente', '>=', from)
      .where('date_vente', '<=', to)
      .orderBy('date_vente', 'asc')
      .orderBy('id', 'asc'),
    Paiement.query()
      .where('type', 'vente')
      .whereIn(
        'reference_id',
        db
          .from('ventes')
          .select('id')
          .where('client_id', clientId)
          .where('point_de_vente_id', pointDeVenteId)
      )
      .where('date_paiement', '>=', from)
      .where('date_paiement', '<=', to)
      .orderBy('date_paiement', 'asc')
      .orderBy('id', 'asc'),
    Reglement.query()
      .where('type', 'client')
      .where('client_id', clientId)
      .where('point_de_vente_id', pointDeVenteId)
      .where('date_reglement', '>=', from)
      .where('date_reglement', '<=', to)
      .orderBy('date_reglement', 'asc')
      .orderBy('id', 'asc'),
  ])

  const venteIds = [...new Set(paiements.map((p) => p.referenceId))]
  const ventesForPaiements =
    venteIds.length > 0 ? await Vente.query().whereIn('id', venteIds) : []
  const venteMap = new Map(ventesForPaiements.map((v) => [v.id, v]))

  const operations: ClientReleveOperation[] = []

  for (const v of ventes) {
    const montant = Number(v.totalTtc)
    if (v.statut === 'retour') {
      operations.push({
        sortKey: `${toSqlDate(v.dateVente)}-1-${String(v.id).padStart(10, '0')}`,
        date: toSqlDate(v.dateVente),
        reference: v.numero,
        designation: `Retour ${v.numero}`,
        debit: 0,
        credit: montant,
      })
    } else {
      operations.push({
        sortKey: `${toSqlDate(v.dateVente)}-0-${String(v.id).padStart(10, '0')}`,
        date: toSqlDate(v.dateVente),
        reference: v.numero,
        designation: `Facture ${v.numero}`,
        debit: montant,
        credit: 0,
      })
    }
  }

  for (const p of paiements) {
    const vente = venteMap.get(p.referenceId)
    operations.push({
      sortKey: `${toSqlDate(p.datePaiement)}-2-${String(p.id).padStart(10, '0')}`,
      date: toSqlDate(p.datePaiement),
      reference: vente?.numero ?? String(p.referenceId),
      designation: `Paiement ${p.modePaiement} — ${vente?.numero ?? p.referenceId}`,
      debit: 0,
      credit: Number(p.montant),
    })
  }

  for (const r of reglements) {
    const montant = Number(r.montant)
    const reference = r.referenceExterne ?? `REG-${r.id}`
    operations.push({
      sortKey: `${toSqlDate(r.dateReglement)}-3-${String(r.id).padStart(10, '0')}`,
      date: toSqlDate(r.dateReglement),
      reference,
      designation: `Règlement ${r.modePaiement}`,
      debit: montant < 0 ? Math.abs(montant) : 0,
      credit: montant > 0 ? montant : 0,
    })
  }

  operations.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  return operations
}

export async function rapportReleveClient(
  pointDeVenteId: number,
  clientId: number,
  dateFrom: DateTime,
  dateTo: DateTime,
  pagination: PaginationInput = {}
) {
  if (dateFrom > dateTo) {
    throw new RapportBusinessError('date_from doit être antérieure ou égale à date_to')
  }

  const { page, limit, offset } = parsePagination(pagination)

  const client = await Client.query()
    .where('id', clientId)
    .where('point_de_vente_id', pointDeVenteId)
    .first()
  if (!client) throw new RapportBusinessError('Client introuvable')

  const [netDepuisDebut, netPeriode, operations] = await Promise.all([
    clientSoldeNetChange(clientId, pointDeVenteId, dateFrom),
    clientSoldeNetChange(clientId, pointDeVenteId, dateFrom, dateTo),
    buildClientReleveOperations(clientId, pointDeVenteId, dateFrom, dateTo),
  ])

  const soldeActuel = roundMoney(Number(client.solde))
  const soldeInitial = roundMoney(soldeActuel - netDepuisDebut.totalDebit + netDepuisDebut.totalCredit)
  const soldeFinal = roundMoney(soldeInitial + netPeriode.totalDebit - netPeriode.totalCredit)
  const totalMouvements = operations.length
  const meta = buildMeta(totalMouvements, page, limit)
  const pageOperations = operations.slice(offset, offset + limit)

  type Ligne = {
    date: string
    reference: string
    designation: string
    credit: number
    debit: number
    solde: number
  }

  const lignes: Ligne[] = []

  if (page === 1) {
    lignes.push({
      date: toSqlDate(dateFrom),
      reference: '',
      designation: 'Solde initial',
      credit: 0,
      debit: 0,
      solde: soldeInitial,
    })
  }

  let soldeCourant = soldeInitial
  for (let i = 0; i < offset; i++) {
    const op = operations[i]
    soldeCourant = roundMoney(soldeCourant + op.debit - op.credit)
  }

  for (const op of pageOperations) {
    soldeCourant = roundMoney(soldeCourant + op.debit - op.credit)
    lignes.push({
      date: op.date,
      reference: op.reference,
      designation: op.designation,
      credit: roundMoney(op.credit),
      debit: roundMoney(op.debit),
      solde: soldeCourant,
    })
  }

  if (page === meta.lastPage) {
    lignes.push({
      date: toSqlDate(dateTo),
      reference: '',
      designation: 'Solde final',
      credit: 0,
      debit: 0,
      solde: soldeFinal,
    })
  }

  return {
    periode: { dateFrom: toSqlDate(dateFrom), dateTo: toSqlDate(dateTo) },
    client: {
      reference: client.code,
      designation: client.nom,
    },
    totaux: {
      soldeInitial,
      totalDebit: netPeriode.totalDebit,
      totalCredit: netPeriode.totalCredit,
      soldeFinal,
    },
    lignes,
    meta,
  }
}
