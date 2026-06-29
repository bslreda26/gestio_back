import Client from '#models/client'
import Depot from '#models/depot'
import Produit from '#models/produit'
import { applyLowStockAlertFilter, applyStockAlertFilter, applyStockAlertFilterForDepot } from '#helpers/produit_query'
import { RapportBusinessError } from '#services/rapport_service'
import { roundMoney } from '#services/pricing_service'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export type DashboardCriteria = {
  pointDeVenteId: number
  dateDebut: DateTime
  dateFin: DateTime
  depotId?: number
  categorieId?: number
  clientId?: number
}

function toSqlDate(date: DateTime) {
  return date.toISODate()!
}

function normalizeSqlDate(value: Date | string | DateTime) {
  if (value instanceof DateTime) return toSqlDate(value)
  if (value instanceof Date) return toSqlDate(DateTime.fromJSDate(value))
  return String(value).slice(0, 10)
}

function assertValidPeriod(dateDebut: DateTime, dateFin: DateTime) {
  if (dateDebut > dateFin) {
    throw new RapportBusinessError('date_debut doit être antérieure ou égale à date_fin')
  }
}

async function getTotalBalanceClients(pointDeVenteId: number) {
  const row = await Client.query()
    .where('point_de_vente_id', pointDeVenteId)
    .where('is_active', true)
    .select(db.raw('COALESCE(SUM(CAST(solde AS DECIMAL(18,4))), 0) as total'))
    .first()

  const clientsCount = await Client.query()
    .where('point_de_vente_id', pointDeVenteId)
    .where('is_active', true)
    .count('* as total')

  return {
    totalSolde: roundMoney(Number(row?.$extras.total ?? 0)),
    nombreClients: Number(clientsCount[0].$extras.total),
  }
}

async function getValeurStockGlobal(pointDeVenteId: number, depotId?: number) {
  let query = db
    .from('depot_stocks as ds')
    .join('depots as d', 'd.id', 'ds.depot_id')
    .join('produits as p', 'p.id', 'ds.produit_id')
    .where('d.point_de_vente_id', pointDeVenteId)
    .where('d.is_active', true)
    .where('p.is_active', true)

  if (depotId) {
    query = query.where('ds.depot_id', depotId)
  }

  const row = await query
    .select(
      db.raw('COALESCE(SUM(CAST(p.plancher AS DECIMAL(18,4)) * ds.quantite), 0) as valeur_globale')
    )
    .first()

  return roundMoney(Number(row?.valeur_globale ?? 0))
}

async function getNombreDepots(pointDeVenteId: number) {
  const count = await Depot.query()
    .where('point_de_vente_id', pointDeVenteId)
    .where('is_active', true)
    .count('* as total')

  return Number(count[0].$extras.total)
}

async function getAlertesStock(pointDeVenteId: number, depotId?: number) {
  const baseQuery = () =>
    Produit.query().where('point_de_vente_id', pointDeVenteId).where('is_active', true)

  const [ruptureCount, alerteCount, totalCount] = await Promise.all([
    (async () => {
      const query = baseQuery()
      if (depotId) {
        applyStockAlertFilterForDepot(query, 'rupture', depotId)
      } else {
        applyStockAlertFilter(query, 'rupture')
      }
      const row = await query.count('* as total')
      return Number(row[0].$extras.total)
    })(),
    (async () => {
      const query = baseQuery()
      if (depotId) {
        applyStockAlertFilterForDepot(query, 'alerte', depotId)
      } else {
        applyStockAlertFilter(query, 'alerte')
      }
      const row = await query.count('* as total')
      return Number(row[0].$extras.total)
    })(),
    (async () => {
      const query = baseQuery()
      applyLowStockAlertFilter(query, depotId)
      const row = await query.count('* as total')
      return Number(row[0].$extras.total)
    })(),
  ])

  return {
    total: totalCount,
    rupture: ruptureCount,
    alerte: alerteCount,
  }
}

async function getVentesProgression(criteria: DashboardCriteria) {
  const { pointDeVenteId, dateDebut, dateFin, depotId, categorieId, clientId } = criteria
  const from = toSqlDate(dateDebut)
  const to = toSqlDate(dateFin)

  if (categorieId) {
    let query = db
      .from('vente_lignes as vl')
      .join('ventes as v', 'v.id', 'vl.vente_id')
      .join('produits as p', 'p.id', 'vl.produit_id')
      .where('v.point_de_vente_id', pointDeVenteId)
      .whereIn('v.statut', ['valide', 'retour'])
      .where('v.date_vente', '>=', from)
      .where('v.date_vente', '<=', to)
      .where('p.categorie_id', categorieId)
      .groupBy('v.date_vente')
      .orderBy('v.date_vente', 'asc')
      .select('v.date_vente as date')
      .select(
        db.raw(`
          COALESCE(SUM(
            CASE
              WHEN v.statut = 'valide' THEN CAST(vl.montant_ttc AS DECIMAL(18,4))
              WHEN v.statut = 'retour' THEN -CAST(vl.montant_ttc AS DECIMAL(18,4))
              ELSE 0
            END
          ), 0) as chiffre_affaires
        `)
      )
      .select(
        db.raw(`
          COUNT(DISTINCT CASE WHEN v.statut = 'valide' THEN v.id END) as nombre_ventes
        `)
      )

    if (depotId) query = query.where('v.depot_id', depotId)
    if (clientId) query = query.where('v.client_id', clientId)

    const rows = await query
    const points = rows.map((row) => ({
      date: normalizeSqlDate(row.date),
      chiffreAffaires: roundMoney(Number(row.chiffre_affaires)),
      nombreVentes: Number(row.nombre_ventes),
    }))

    const totaux = points.reduce(
      (acc, point) => {
        acc.chiffreAffaires += point.chiffreAffaires
        acc.nombreVentes += point.nombreVentes
        return acc
      },
      { chiffreAffaires: 0, nombreVentes: 0 }
    )

    return {
      periode: { date_debut: from, date_fin: to },
      criteres: {
        depot_id: depotId ?? null,
        categorie_id: categorieId ?? null,
        client_id: clientId ?? null,
      },
      totaux: {
        chiffreAffaires: roundMoney(totaux.chiffreAffaires),
        nombreVentes: totaux.nombreVentes,
      },
      points,
    }
  }

  let query = db
    .from('ventes as v')
    .where('v.point_de_vente_id', pointDeVenteId)
    .whereIn('v.statut', ['valide', 'retour'])
    .where('v.date_vente', '>=', from)
    .where('v.date_vente', '<=', to)
    .groupBy('v.date_vente')
    .orderBy('v.date_vente', 'asc')
    .select('v.date_vente as date')
    .select(
      db.raw(`
        COALESCE(SUM(
          CASE
            WHEN v.statut = 'valide' THEN CAST(v.total_apres_airsi AS DECIMAL(18,4))
            WHEN v.statut = 'retour' THEN -CAST(v.total_apres_airsi AS DECIMAL(18,4))
            ELSE 0
          END
        ), 0) as chiffre_affaires
      `)
    )
    .select(
      db.raw(`
        COUNT(DISTINCT CASE WHEN v.statut = 'valide' THEN v.id END) as nombre_ventes
      `)
    )

  if (depotId) query = query.where('v.depot_id', depotId)
  if (clientId) query = query.where('v.client_id', clientId)

  const rows = await query
  const points = rows.map((row) => ({
    date: normalizeSqlDate(row.date),
    chiffreAffaires: roundMoney(Number(row.chiffre_affaires)),
    nombreVentes: Number(row.nombre_ventes),
  }))

  const totaux = points.reduce(
    (acc, point) => {
      acc.chiffreAffaires += point.chiffreAffaires
      acc.nombreVentes += point.nombreVentes
      return acc
    },
    { chiffreAffaires: 0, nombreVentes: 0 }
  )

  return {
    periode: { date_debut: from, date_fin: to },
    criteres: {
      depot_id: depotId ?? null,
      categorie_id: categorieId ?? null,
      client_id: clientId ?? null,
    },
    totaux: {
      chiffreAffaires: roundMoney(totaux.chiffreAffaires),
      nombreVentes: totaux.nombreVentes,
    },
    points,
  }
}

async function getTopProduitsMarge(criteria: DashboardCriteria, limit = 10) {
  const { pointDeVenteId, dateDebut, dateFin, depotId, categorieId } = criteria
  const from = toSqlDate(dateDebut)
  const to = toSqlDate(dateFin)

  let query = db
    .from('vente_lignes as vl')
    .join('ventes as v', 'v.id', 'vl.vente_id')
    .join('produits as p', 'p.id', 'vl.produit_id')
    .where('v.point_de_vente_id', pointDeVenteId)
    .whereIn('v.statut', ['valide', 'retour'])
    .where('v.date_vente', '>=', from)
    .where('v.date_vente', '<=', to)
    .where('p.is_active', true)
    .groupBy('vl.produit_id', 'p.code', 'p.nom', 'p.categorie_id')
    .select('vl.produit_id as id', 'p.code', 'p.nom', 'p.categorie_id as categorie_id')
    .select(
      db.raw(`
        COALESCE(SUM(
          CASE
            WHEN v.statut = 'valide' THEN CAST(vl.montant_ttc AS DECIMAL(18,4))
            WHEN v.statut = 'retour' THEN -CAST(vl.montant_ttc AS DECIMAL(18,4))
            ELSE 0
          END
        ), 0) as chiffre_affaires
      `)
    )
    .select(
      db.raw(`
        COALESCE(SUM(
          CASE
            WHEN v.sous_total > 0 THEN
              (CASE WHEN v.statut = 'valide' THEN 1 WHEN v.statut = 'retour' THEN -1 ELSE 0 END)
              * CAST(vl.marge AS DECIMAL(18,4))
              * CAST(vl.quantite AS DECIMAL(18,4))
              * (1 - CAST(vl.remise_pct AS DECIMAL(18,4)) / 100)
              * (CAST(v.total_ttc AS DECIMAL(18,4)) / CAST(v.sous_total AS DECIMAL(18,4)))
            ELSE 0
          END
        ), 0) as marge_montant
      `)
    )
    .orderBy('marge_montant', 'desc')
    .limit(limit)

  if (depotId) query = query.where('v.depot_id', depotId)
  if (categorieId) query = query.where('p.categorie_id', categorieId)

  const rows = await query

  return rows.map((row) => {
    const chiffreAffaires = roundMoney(Number(row.chiffre_affaires))
    const margeMontant = roundMoney(Number(row.marge_montant))
    const margePct = chiffreAffaires > 0 ? roundMoney((margeMontant / chiffreAffaires) * 100) : 0

    return {
      id: Number(row.id),
      code: row.code,
      nom: row.nom,
      categorieId: row.categorie_id ?? null,
      chiffreAffaires,
      margeMontant,
      margePct,
    }
  })
}

export async function getDashboard(criteria: DashboardCriteria) {
  assertValidPeriod(criteria.dateDebut, criteria.dateFin)

  const [balanceClients, valeurStockGlobal, nombreDepots, alertesStock, ventesProgression, topProduitsMarge] =
    await Promise.all([
      getTotalBalanceClients(criteria.pointDeVenteId),
      getValeurStockGlobal(criteria.pointDeVenteId, criteria.depotId),
      getNombreDepots(criteria.pointDeVenteId),
      getAlertesStock(criteria.pointDeVenteId, criteria.depotId),
      getVentesProgression(criteria),
      getTopProduitsMarge(criteria),
    ])

  return {
    cartes: {
      totalBalanceClients: balanceClients.totalSolde,
      nombreClients: balanceClients.nombreClients,
      valeurStockGlobal,
      nombreDepots,
      alertesStock,
    },
    ventesProgression,
    topProduitsMarge,
  }
}
