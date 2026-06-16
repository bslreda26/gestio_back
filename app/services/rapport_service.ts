import Client from '#models/client'
import Achat from '#models/achat'
import AchatLigne from '#models/achat_ligne'
import DepenseCategory from '#models/depense_category'
import Fournisseur from '#models/fournisseur'
import Produit from '#models/produit'
import Vente from '#models/vente'
import Paiement from '#models/paiement'
import Reglement from '#models/reglement'
import CaisseMouvement from '#models/caisse_mouvement'
import { buildMeta, parsePagination, type PaginationInput } from '#helpers/pagination'
import { applyStockAlertFilter, getStockStatus } from '#helpers/produit_query'
import { roundMoney } from '#services/pricing_service'
import { calcReceptionTtc } from '#services/achat_service'
import { ACHAT_STATUT } from '#constants/achat_statuts'
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

  const [countRow, allClients, clients] = await Promise.all([
    clientQuery.clone().count('* as total'),
    clientReportQuery(filters).select('id'),
    clientQuery.offset(offset).limit(limit),
  ])

  const totalClients = Number(countRow[0].$extras.total)
  const meta = buildMeta(totalClients, page, limit)
  const allIds = allClients.map((client) => client.id)
  const pageIds = clients.map((client) => client.id)

  const [allSoldes, pageSoldes] = await Promise.all([
    computeClientSoldesPdv(filters.pointDeVenteId, allIds),
    computeClientSoldesPdv(filters.pointDeVenteId, pageIds),
  ])

  const lignes = clients.map((client) => ({
    reference: client.code,
    designation: client.nom,
    solde: pageSoldes.get(client.id) ?? 0,
  }))

  const totalSoldeClients = roundMoney(
    [...allSoldes.values()].reduce((sum, solde) => sum + solde, 0)
  )

  return {
    lignes,
    meta,
    totaux: {
      nombreClients: totalClients,
      totalSoldeClients,
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

function applyReleveDateFilter(
  query: ReturnType<typeof db.from>,
  column: string,
  dateFrom?: DateTime,
  dateTo?: DateTime
) {
  if (dateFrom) query.where(column, '>=', toSqlDate(dateFrom))
  if (dateTo) query.where(column, '<=', toSqlDate(dateTo))
  return query
}

async function clientSoldeNetChange(
  clientId: number,
  pointDeVenteId: number,
  dateFrom?: DateTime,
  dateTo?: DateTime
) {
  const venteBase = () =>
    db.from('ventes').where('client_id', clientId).where('point_de_vente_id', pointDeVenteId)

  const paiementBase = () =>
    db
      .from('paiements')
      .join('ventes', 'paiements.reference_id', 'ventes.id')
      .where('paiements.type', 'vente')
      .where('ventes.client_id', clientId)
      .where('ventes.point_de_vente_id', pointDeVenteId)
      .whereIn('ventes.statut', ['valide', 'retour'])

  const [facturesRow, retoursRow, paiementsRow, reglementsRow] = await Promise.all([
    applyReleveDateFilter(venteBase().where('statut', 'valide'), 'date_vente', dateFrom, dateTo).sum(
      'total_ttc as total'
    ),
    applyReleveDateFilter(venteBase().where('statut', 'retour'), 'date_vente', dateFrom, dateTo).sum(
      'total_ttc as total'
    ),
    applyReleveDateFilter(paiementBase(), 'paiements.date_paiement', dateFrom, dateTo).sum(
      'paiements.montant as total'
    ),
    applyReleveDateFilter(
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

function clientSoldeFromNet(totalDebit: number, totalCredit: number) {
  return roundMoney(totalDebit - totalCredit)
}

/** Solde client recalculé depuis les mouvements (même logique que le relevé). */
export async function computeClientSoldePdv(clientId: number, pointDeVenteId: number) {
  const net = await clientSoldeNetChange(clientId, pointDeVenteId)
  return clientSoldeFromNet(net.totalDebit, net.totalCredit)
}

export async function computeClientSoldesPdv(pointDeVenteId: number, clientIds: number[]) {
  const soldes = new Map<number, number>()
  for (const id of clientIds) soldes.set(id, 0)
  if (clientIds.length === 0) return soldes

  await Promise.all(
    clientIds.map(async (clientId) => {
      soldes.set(clientId, await computeClientSoldePdv(clientId, pointDeVenteId))
    })
  )

  return soldes
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
      .whereIn('statut', ['valide', 'retour'])
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
          .whereIn('statut', ['valide', 'retour'])
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

  const [soldeAvantPeriode, netPeriode, operations] = await Promise.all([
    clientSoldeNetChange(clientId, pointDeVenteId, undefined, dateFrom.minus({ days: 1 })),
    clientSoldeNetChange(clientId, pointDeVenteId, dateFrom, dateTo),
    buildClientReleveOperations(clientId, pointDeVenteId, dateFrom, dateTo),
  ])

  const soldeInitial = clientSoldeFromNet(
    soldeAvantPeriode.totalDebit,
    soldeAvantPeriode.totalCredit
  )
  const soldeFinal = clientSoldeFromNet(
    soldeAvantPeriode.totalDebit + netPeriode.totalDebit,
    soldeAvantPeriode.totalCredit + netPeriode.totalCredit
  )
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

export async function rapportDepenses(
  pointDeVenteId: number,
  dateDebut: DateTime,
  dateFin: DateTime
) {
  if (dateDebut > dateFin) {
    throw new RapportBusinessError('date_debut doit être antérieure ou égale à date_fin')
  }

  const [categories, totalsByCategorie] = await Promise.all([
    DepenseCategory.query().where('is_active', true).orderBy('libelle', 'asc'),
    db
      .from('depenses')
      .where('point_de_vente_id', pointDeVenteId)
      .where('date_depense', '>=', toSqlDate(dateDebut))
      .where('date_depense', '<=', toSqlDate(dateFin))
      .groupBy('categorie')
      .select('categorie')
      .sum('montant as total'),
  ])

  const totalMap = new Map(
    totalsByCategorie.map((row) => [row.categorie as string, roundMoney(Number(row.total))])
  )

  const lignes: { categorie: string; libelle: string; total: number }[] = []
  const seenCodes = new Set<string>()

  for (const category of categories) {
    seenCodes.add(category.code)
    lignes.push({
      categorie: category.code,
      libelle: category.libelle,
      total: totalMap.get(category.code) ?? 0,
    })
  }

  for (const [code, total] of totalMap) {
    if (!seenCodes.has(code)) {
      lignes.push({
        categorie: code,
        libelle: code,
        total,
      })
    }
  }

  lignes.sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))

  const totalDepenses = roundMoney(lignes.reduce((sum, ligne) => sum + ligne.total, 0))

  return {
    periode: { date_debut: toSqlDate(dateDebut), date_fin: toSqlDate(dateFin) },
    lignes,
    totaux: {
      total_depenses: totalDepenses,
    },
  }
}

function chiffreAffaireVentesQuery(
  pointDeVenteId: number,
  dateDebut?: DateTime,
  dateFin?: DateTime
) {
  let query = db
    .from('ventes')
    .where('point_de_vente_id', pointDeVenteId)
    .whereIn('statut', ['valide', 'retour'])

  if (dateDebut) query = query.where('date_vente', '>=', toSqlDate(dateDebut))
  if (dateFin) query = query.where('date_vente', '<=', toSqlDate(dateFin))

  return query
}

function calcChiffreAffairesSql(alias = '') {
  const prefix = alias ? `${alias}.` : ''
  return db.raw(
    `COALESCE(SUM(CASE WHEN ${prefix}statut = 'valide' THEN ${prefix}total_ttc ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN ${prefix}statut = 'retour' THEN ${prefix}total_ttc ELSE 0 END), 0) as chiffre_affaires`
  )
}

export async function rapportChiffreAffaire(filters: {
  pointDeVenteId: number
  dateDebut?: DateTime
  dateFin?: DateTime
  page?: number
  limit?: number
  clientId?: number
  search?: string
}) {
  if (filters.dateDebut && filters.dateFin && filters.dateDebut > filters.dateFin) {
    throw new RapportBusinessError('date_debut doit être antérieure ou égale à date_fin')
  }

  const { page, limit, offset } = parsePagination(filters)
  const clientQuery = clientReportQuery(filters).orderBy('nom', 'asc')

  const ventesQuery = () =>
    chiffreAffaireVentesQuery(filters.pointDeVenteId, filters.dateDebut, filters.dateFin)

  const [countRow, globalRow, clients, caByClient] = await Promise.all([
    clientQuery.clone().count('* as total'),
    ventesQuery().select(calcChiffreAffairesSql()).first(),
    clientQuery.offset(offset).limit(limit),
    ventesQuery().select('client_id').select(calcChiffreAffairesSql()).groupBy('client_id'),
  ])

  const totalClients = Number(countRow[0].$extras.total)
  const meta = buildMeta(totalClients, page, limit)
  const caMap = new Map(
    caByClient.map((row) => [row.client_id as number, roundMoney(Number(row.chiffre_affaires))])
  )

  const lignes = clients.map((client) => ({
    reference: client.code,
    designation: client.nom,
    chiffre_affaires: caMap.get(client.id) ?? 0,
  }))

  const chiffreAffairesGlobal = roundMoney(Number(globalRow?.chiffre_affaires ?? 0))

  return {
    ...(filters.dateDebut || filters.dateFin
      ? {
          periode: {
            ...(filters.dateDebut ? { date_debut: toSqlDate(filters.dateDebut) } : {}),
            ...(filters.dateFin ? { date_fin: toSqlDate(filters.dateFin) } : {}),
          },
        }
      : {}),
    lignes,
    meta,
    totaux: {
      nombre_clients: totalClients,
      chiffre_affaires_global: chiffreAffairesGlobal,
    },
  }
}

function fournisseurReportQuery(filters: {
  fournisseurId?: number
  search?: string
}) {
  const query = Fournisseur.query().where('is_active', true)
  if (filters.fournisseurId) query.where('id', filters.fournisseurId)
  if (filters.search) {
    const term = `%${filters.search}%`
    query.where((q) =>
      q
        .whereILike('nom', term)
        .orWhereILike('code', term)
        .orWhereILike('telephone', term)
        .orWhereILike('ville', term)
    )
  }
  return query
}

function sumLignesRecuTtc(lignes: AchatLigne[]) {
  return roundMoney(
    lignes.reduce(
      (sum, ligne) =>
        sum +
        calcReceptionTtc(
          Number(ligne.quantiteRecue),
          Number(ligne.prixUnitaireHt),
          Number(ligne.tvaPct)
        ),
      0
    )
  )
}

async function sumAchatsRecusTtcFiltered(
  fournisseurId: number,
  pointDeVenteId: number,
  dateFrom?: DateTime,
  dateTo?: DateTime
) {
  let query = Achat.query()
    .where('fournisseur_id', fournisseurId)
    .where('point_de_vente_id', pointDeVenteId)
    .where('statut', ACHAT_STATUT.ACHAT)
    .whereNotNull('date_reception')

  if (dateFrom) query.where('date_reception', '>=', toSqlDate(dateFrom))
  if (dateTo) query.where('date_reception', '<=', toSqlDate(dateTo))

  const achats = await query
  if (achats.length === 0) return 0

  const lignes = await AchatLigne.query().whereIn(
    'achat_id',
    achats.map((achat) => achat.id)
  )
  const lignesByAchat = new Map<number, AchatLigne[]>()
  for (const ligne of lignes) {
    const list = lignesByAchat.get(ligne.achatId) ?? []
    list.push(ligne)
    lignesByAchat.set(ligne.achatId, list)
  }

  return roundMoney(
    achats.reduce(
      (sum, achat) => sum + sumLignesRecuTtc(lignesByAchat.get(achat.id) ?? []),
      0
    )
  )
}

async function fournisseurSoldeNetChange(
  fournisseurId: number,
  pointDeVenteId: number,
  dateFrom?: DateTime,
  dateTo?: DateTime
) {
  const achatBase = () =>
    db
      .from('achats')
      .where('fournisseur_id', fournisseurId)
      .where('point_de_vente_id', pointDeVenteId)

  const [achatsRecusTotal, retoursRow, paiementsRow, reglementsRow] = await Promise.all([
    sumAchatsRecusTtcFiltered(fournisseurId, pointDeVenteId, dateFrom, dateTo),
    applyReleveDateFilter(achatBase().where('statut', ACHAT_STATUT.RETOUR), 'date_achat', dateFrom, dateTo).sum(
      'total_ttc as total'
    ),
    applyReleveDateFilter(
      db
        .from('paiements')
        .join('achats', 'paiements.reference_id', 'achats.id')
        .where('paiements.type', 'achat')
        .where('achats.fournisseur_id', fournisseurId)
        .where('achats.point_de_vente_id', pointDeVenteId),
      'paiements.date_paiement',
      dateFrom,
      dateTo
    ).sum('paiements.montant as total'),
    applyReleveDateFilter(
      db
        .from('reglements')
        .where('type', 'fournisseur')
        .where('fournisseur_id', fournisseurId)
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
    achatsRecusTotal + Number(reglementsRow?.total_debit ?? 0)
  )
  const totalCredit = roundMoney(
    Number(retoursRow[0]?.total ?? 0) +
      Number(paiementsRow[0]?.total ?? 0) +
      Number(reglementsRow?.total_credit ?? 0)
  )

  return { totalDebit, totalCredit }
}

function fournisseurSoldeFromNet(totalDebit: number, totalCredit: number) {
  return roundMoney(totalDebit - totalCredit)
}

/** Solde fournisseur recalculé depuis les mouvements PDV (même logique que le relevé). */
export async function computeFournisseurSoldePdv(fournisseurId: number, pointDeVenteId: number) {
  const net = await fournisseurSoldeNetChange(fournisseurId, pointDeVenteId)
  return fournisseurSoldeFromNet(net.totalDebit, net.totalCredit)
}

export async function computeFournisseurSoldesPdv(pointDeVenteId: number, fournisseurIds: number[]) {
  const soldes = new Map<number, number>()
  for (const id of fournisseurIds) soldes.set(id, 0)
  if (fournisseurIds.length === 0) return soldes

  await Promise.all(
    fournisseurIds.map(async (fournisseurId) => {
      soldes.set(fournisseurId, await computeFournisseurSoldePdv(fournisseurId, pointDeVenteId))
    })
  )

  return soldes
}

type FournisseurReleveOperation = {
  sortKey: string
  date: string
  reference: string
  designation: string
  debit: number
  credit: number
}

async function buildFournisseurReleveOperations(
  fournisseurId: number,
  pointDeVenteId: number,
  dateFrom: DateTime,
  dateTo: DateTime
) {
  const from = toSqlDate(dateFrom)
  const to = toSqlDate(dateTo)

  const [achatsRecus, retours, paiements, reglements] = await Promise.all([
    Achat.query()
      .where('fournisseur_id', fournisseurId)
      .where('point_de_vente_id', pointDeVenteId)
      .where('statut', ACHAT_STATUT.ACHAT)
      .whereNotNull('date_reception')
      .where('date_reception', '>=', from)
      .where('date_reception', '<=', to)
      .orderBy('date_reception', 'asc')
      .orderBy('id', 'asc'),
    Achat.query()
      .where('fournisseur_id', fournisseurId)
      .where('point_de_vente_id', pointDeVenteId)
      .where('statut', ACHAT_STATUT.RETOUR)
      .where('date_achat', '>=', from)
      .where('date_achat', '<=', to)
      .orderBy('date_achat', 'asc')
      .orderBy('id', 'asc'),
    Paiement.query()
      .where('type', 'achat')
      .whereIn(
        'reference_id',
        db
          .from('achats')
          .select('id')
          .where('fournisseur_id', fournisseurId)
          .where('point_de_vente_id', pointDeVenteId)
      )
      .where('date_paiement', '>=', from)
      .where('date_paiement', '<=', to)
      .orderBy('date_paiement', 'asc')
      .orderBy('id', 'asc'),
    Reglement.query()
      .where('type', 'fournisseur')
      .where('fournisseur_id', fournisseurId)
      .where('point_de_vente_id', pointDeVenteId)
      .where('date_reglement', '>=', from)
      .where('date_reglement', '<=', to)
      .orderBy('date_reglement', 'asc')
      .orderBy('id', 'asc'),
  ])

  const achatIds = [
    ...new Set([
      ...achatsRecus.map((achat) => achat.id),
      ...retours.map((achat) => achat.id),
      ...paiements.map((paiement) => paiement.referenceId),
    ]),
  ]
  const achatsForReferences =
    achatIds.length > 0 ? await Achat.query().whereIn('id', achatIds) : []
  const achatMap = new Map(achatsForReferences.map((achat) => [achat.id, achat]))

  const lignes =
    achatsRecus.length > 0
      ? await AchatLigne.query().whereIn(
          'achat_id',
          achatsRecus.map((achat) => achat.id)
        )
      : []
  const lignesByAchat = new Map<number, AchatLigne[]>()
  for (const ligne of lignes) {
    const list = lignesByAchat.get(ligne.achatId) ?? []
    list.push(ligne)
    lignesByAchat.set(ligne.achatId, list)
  }

  const operations: FournisseurReleveOperation[] = []

  for (const achat of achatsRecus) {
    const montant = sumLignesRecuTtc(lignesByAchat.get(achat.id) ?? [])
    if (montant <= 0) continue

    operations.push({
      sortKey: `${toSqlDate(achat.dateReception!)}-0-${String(achat.id).padStart(10, '0')}`,
      date: toSqlDate(achat.dateReception!),
      reference: achat.numero,
      designation: `Réception achat ${achat.numero}`,
      debit: montant,
      credit: 0,
    })
  }

  for (const achat of retours) {
    const montant = Number(achat.totalTtc)
    operations.push({
      sortKey: `${toSqlDate(achat.dateAchat)}-1-${String(achat.id).padStart(10, '0')}`,
      date: toSqlDate(achat.dateAchat),
      reference: achat.numero,
      designation: `Retour achat ${achat.numero}`,
      debit: 0,
      credit: montant,
    })
  }

  for (const paiement of paiements) {
    const achat = achatMap.get(paiement.referenceId)
    operations.push({
      sortKey: `${toSqlDate(paiement.datePaiement)}-2-${String(paiement.id).padStart(10, '0')}`,
      date: toSqlDate(paiement.datePaiement),
      reference: achat?.numero ?? String(paiement.referenceId),
      designation: `Paiement ${paiement.modePaiement} — ${achat?.numero ?? paiement.referenceId}`,
      debit: 0,
      credit: Number(paiement.montant),
    })
  }

  for (const reglement of reglements) {
    const montant = Number(reglement.montant)
    const reference = reglement.referenceExterne ?? `REG-${reglement.id}`
    operations.push({
      sortKey: `${toSqlDate(reglement.dateReglement)}-3-${String(reglement.id).padStart(10, '0')}`,
      date: toSqlDate(reglement.dateReglement),
      reference,
      designation: `Règlement ${reglement.modePaiement}`,
      debit: montant < 0 ? Math.abs(montant) : 0,
      credit: montant > 0 ? montant : 0,
    })
  }

  operations.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  return operations
}

export async function rapportBalanceFournisseurs(filters: {
  pointDeVenteId: number
  page?: number
  limit?: number
  fournisseurId?: number
  search?: string
}) {
  const { page, limit, offset } = parsePagination(filters)
  const fournisseurQuery = fournisseurReportQuery(filters).orderBy('nom', 'asc')

  const [countRow, allFournisseurs, fournisseurs] = await Promise.all([
    fournisseurQuery.clone().count('* as total'),
    fournisseurReportQuery(filters).select('id'),
    fournisseurQuery.offset(offset).limit(limit),
  ])

  const totalFournisseurs = Number(countRow[0].$extras.total)
  const meta = buildMeta(totalFournisseurs, page, limit)
  const allIds = allFournisseurs.map((fournisseur) => fournisseur.id)
  const pageIds = fournisseurs.map((fournisseur) => fournisseur.id)

  const [allSoldes, pageSoldes] = await Promise.all([
    computeFournisseurSoldesPdv(filters.pointDeVenteId, allIds),
    computeFournisseurSoldesPdv(filters.pointDeVenteId, pageIds),
  ])

  const lignes = fournisseurs.map((fournisseur) => ({
    reference: fournisseur.code,
    designation: fournisseur.nom,
    solde: pageSoldes.get(fournisseur.id) ?? 0,
  }))

  const totalSoldeFournisseurs = roundMoney(
    [...allSoldes.values()].reduce((sum, solde) => sum + solde, 0)
  )

  return {
    lignes,
    meta,
    totaux: {
      nombreFournisseurs: totalFournisseurs,
      totalSoldeFournisseurs,
    },
  }
}

export async function rapportReleveFournisseur(
  pointDeVenteId: number,
  fournisseurId: number,
  dateFrom: DateTime,
  dateTo: DateTime,
  pagination: PaginationInput = {}
) {
  if (dateFrom > dateTo) {
    throw new RapportBusinessError('date_from doit être antérieure ou égale à date_to')
  }

  const { page, limit, offset } = parsePagination(pagination)

  const fournisseur = await Fournisseur.query().where('id', fournisseurId).where('is_active', true).first()
  if (!fournisseur) throw new RapportBusinessError('Fournisseur introuvable')

  const soldeAvantPeriode = await fournisseurSoldeNetChange(
    fournisseurId,
    pointDeVenteId,
    undefined,
    dateFrom.minus({ days: 1 })
  )
  const netPeriode = await fournisseurSoldeNetChange(
    fournisseurId,
    pointDeVenteId,
    dateFrom,
    dateTo
  )
  const operations = await buildFournisseurReleveOperations(
    fournisseurId,
    pointDeVenteId,
    dateFrom,
    dateTo
  )

  const soldeInitial = fournisseurSoldeFromNet(
    soldeAvantPeriode.totalDebit,
    soldeAvantPeriode.totalCredit
  )
  const soldeFinal = fournisseurSoldeFromNet(
    soldeAvantPeriode.totalDebit + netPeriode.totalDebit,
    soldeAvantPeriode.totalCredit + netPeriode.totalCredit
  )
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
    const operation = operations[i]
    soldeCourant = roundMoney(soldeCourant + operation.debit - operation.credit)
  }

  for (const operation of pageOperations) {
    soldeCourant = roundMoney(soldeCourant + operation.debit - operation.credit)
    lignes.push({
      date: operation.date,
      reference: operation.reference,
      designation: operation.designation,
      credit: roundMoney(operation.credit),
      debit: roundMoney(operation.debit),
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
    fournisseur: {
      reference: fournisseur.code,
      designation: fournisseur.nom,
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

type ReglementReportFilters = {
  pointDeVenteId: number
  dateFrom: DateTime
  dateTo: DateTime
  page?: number
  limit?: number
  modePaiement?: string
  search?: string
}

function clientReglementReportQuery(filters: ReglementReportFilters & { clientId?: number }) {
  const query = Reglement.query()
    .where('type', 'client')
    .where('point_de_vente_id', filters.pointDeVenteId)
    .where('date_reglement', '>=', toSqlDate(filters.dateFrom))
    .where('date_reglement', '<=', toSqlDate(filters.dateTo))

  if (filters.clientId) query.where('client_id', filters.clientId)
  if (filters.modePaiement) query.where('mode_paiement', filters.modePaiement)
  if (filters.search) {
    const term = `%${filters.search}%`
    query.whereIn(
      'client_id',
      Client.query()
        .where('point_de_vente_id', filters.pointDeVenteId)
        .where((q) => q.whereILike('nom', term).orWhereILike('code', term))
        .select('id')
    )
  }

  return query
}

function fournisseurReglementReportQuery(
  filters: ReglementReportFilters & { fournisseurId?: number }
) {
  const query = Reglement.query()
    .where('type', 'fournisseur')
    .where('point_de_vente_id', filters.pointDeVenteId)
    .where('date_reglement', '>=', toSqlDate(filters.dateFrom))
    .where('date_reglement', '<=', toSqlDate(filters.dateTo))

  if (filters.fournisseurId) query.where('fournisseur_id', filters.fournisseurId)
  if (filters.modePaiement) query.where('mode_paiement', filters.modePaiement)
  if (filters.search) {
    const term = `%${filters.search}%`
    query.whereIn(
      'fournisseur_id',
      Fournisseur.query()
        .where((q) =>
          q.whereILike('nom', term).orWhereILike('code', term).orWhereILike('ville', term)
        )
        .select('id')
    )
  }

  return query
}

async function buildReglementReportTotals(baseQuery: ReturnType<typeof clientReglementReportQuery>) {
  const [countRow, totalsRow] = await Promise.all([
    baseQuery.clone().count('* as total'),
    baseQuery
      .clone()
      .select(
        db.raw('COALESCE(SUM(CASE WHEN montant > 0 THEN montant ELSE 0 END), 0) as total_encaissements'),
        db.raw('COALESCE(SUM(CASE WHEN montant < 0 THEN ABS(montant) ELSE 0 END), 0) as total_remboursements'),
        db.raw('COALESCE(SUM(montant), 0) as total_net')
      )
      .first() as Promise<{
      total_encaissements: string | number
      total_remboursements: string | number
      total_net: string | number
    } | null>,
  ])

  return {
    nombreReglements: Number(countRow[0].$extras.total),
    totalEncaissements: roundMoney(Number(totalsRow?.total_encaissements ?? 0)),
    totalRemboursements: roundMoney(Number(totalsRow?.total_remboursements ?? 0)),
    totalNet: roundMoney(Number(totalsRow?.total_net ?? 0)),
  }
}

export async function rapportReglementClients(
  filters: ReglementReportFilters & { clientId?: number }
) {
  if (filters.dateFrom > filters.dateTo) {
    throw new RapportBusinessError('date_from doit être antérieure ou égale à date_to')
  }

  const { page, limit, offset } = parsePagination(filters)
  const baseQuery = clientReglementReportQuery(filters)

  const [totaux, reglements] = await Promise.all([
    buildReglementReportTotals(baseQuery),
    baseQuery
      .clone()
      .orderBy('date_reglement', 'asc')
      .orderBy('id', 'asc')
      .offset(offset)
      .limit(limit),
  ])

  const clientIds = [...new Set(reglements.map((r) => r.clientId).filter((id): id is number => id !== null))]
  const clients =
    clientIds.length > 0
      ? await Client.query().whereIn('id', clientIds)
      : []
  const clientMap = new Map(clients.map((client) => [client.id, client]))
  const meta = buildMeta(totaux.nombreReglements, page, limit)

  const lignes = reglements.map((reglement) => {
    const client = reglement.clientId ? clientMap.get(reglement.clientId) : undefined
    return {
      id: reglement.id,
      date: toSqlDate(reglement.dateReglement),
      reference: client?.code ?? '',
      designation: client?.nom ?? '',
      montant: roundMoney(Number(reglement.montant)),
      modePaiement: reglement.modePaiement,
      referenceExterne: reglement.referenceExterne,
      soldeAvant: roundMoney(Number(reglement.soldeAvant)),
      soldeApres: roundMoney(Number(reglement.soldeApres)),
    }
  })

  return {
    periode: { dateFrom: toSqlDate(filters.dateFrom), dateTo: toSqlDate(filters.dateTo) },
    lignes,
    meta,
    totaux,
  }
}

export async function rapportReglementFournisseurs(
  filters: ReglementReportFilters & { fournisseurId?: number }
) {
  if (filters.dateFrom > filters.dateTo) {
    throw new RapportBusinessError('date_from doit être antérieure ou égale à date_to')
  }

  const { page, limit, offset } = parsePagination(filters)
  const baseQuery = fournisseurReglementReportQuery(filters)

  const [totaux, reglements] = await Promise.all([
    buildReglementReportTotals(baseQuery),
    baseQuery
      .clone()
      .orderBy('date_reglement', 'asc')
      .orderBy('id', 'asc')
      .offset(offset)
      .limit(limit),
  ])

  const fournisseurIds = [
    ...new Set(reglements.map((r) => r.fournisseurId).filter((id): id is number => id !== null)),
  ]
  const fournisseurs =
    fournisseurIds.length > 0
      ? await Fournisseur.query().whereIn('id', fournisseurIds)
      : []
  const fournisseurMap = new Map(fournisseurs.map((fournisseur) => [fournisseur.id, fournisseur]))
  const meta = buildMeta(totaux.nombreReglements, page, limit)

  const lignes = reglements.map((reglement) => {
    const fournisseur = reglement.fournisseurId
      ? fournisseurMap.get(reglement.fournisseurId)
      : undefined
    return {
      id: reglement.id,
      date: toSqlDate(reglement.dateReglement),
      reference: fournisseur?.code ?? '',
      designation: fournisseur?.nom ?? '',
      montant: roundMoney(Number(reglement.montant)),
      modePaiement: reglement.modePaiement,
      referenceExterne: reglement.referenceExterne,
      soldeAvant: roundMoney(Number(reglement.soldeAvant)),
      soldeApres: roundMoney(Number(reglement.soldeApres)),
    }
  })

  return {
    periode: { dateFrom: toSqlDate(filters.dateFrom), dateTo: toSqlDate(filters.dateTo) },
    lignes,
    meta,
    totaux,
  }
}
