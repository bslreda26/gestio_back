import DepotStock from '#models/depot_stock'
import Produit from '#models/produit'
import StockMouvement from '#models/stock_mouvement'
import { buildMeta, parsePagination } from '#helpers/pagination'
import {
  assertDepotsMemePointDeVente,
  getDefaultDepot,
  getDepotStockQuantite,
  getOrCreateDepotStock,
  resolveDepotForProduit,
  syncProduitStockActuel,
} from '#services/depot_service'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

export class StockInsuffisantError extends Error {
  constructor(produitNom: string, disponible: number, demande: number) {
    super(`Stock insuffisant pour ${produitNom}: disponible ${disponible}, demandé ${demande}`)
    this.name = 'StockInsuffisantError'
  }
}

type StockReference = {
  referenceId?: number
  referenceType?: string
}

type MouvementType = 'entree' | 'sortie' | 'ajustement' | 'transfert'
type MouvementMotif =
  | 'achat'
  | 'vente'
  | 'retour_client'
  | 'retour_fournisseur'
  | 'inventaire'
  | 'perte'
  | 'ajustement_manuel'
  | 'transfert'

async function getProduitOrFail(produitId: number, trx?: TransactionClientContract) {
  const query = trx ? Produit.query({ client: trx }) : Produit.query()
  const produit = await query.where('id', produitId).first()
  if (!produit) throw new Error(`Produit ${produitId} introuvable`)
  return produit
}

async function enregistrerMouvement(
  produit: Produit,
  depotId: number,
  type: MouvementType,
  motif: MouvementMotif,
  quantite: number,
  stockApres: number,
  stockAvant: number,
  userId: number,
  reference: StockReference,
  notes: string | null,
  trx?: TransactionClientContract
) {
  await StockMouvement.create(
    {
      produitId: produit.id,
      depotId,
      type,
      motif,
      quantite,
      stockAvant,
      stockApres,
      referenceId: reference.referenceId ?? null,
      referenceType: reference.referenceType ?? null,
      userId,
      notes,
      createdAt: DateTime.now(),
    },
    trx ? { client: trx } : undefined
  )

  await syncProduitStockActuel(produit.id, trx)
}

export async function getStockDisponible(
  produitId: number,
  depotId?: number,
  trx?: TransactionClientContract
) {
  const produit = await getProduitOrFail(produitId, trx)
  const depot = await resolveDepotForProduit(produit, depotId, trx)
  const quantite = await getDepotStockQuantite(produit.id, depot.id, trx)
  return { produit, depot, quantite }
}

export async function getStockTotalDisponible(
  produitId: number,
  trx?: TransactionClientContract
) {
  const produit = await getProduitOrFail(produitId, trx)
  let sumQuery = db
    .from('depot_stocks as ds')
    .join('depots as d', 'd.id', 'ds.depot_id')
    .where('ds.produit_id', produitId)
    .where('d.point_de_vente_id', produit.pointDeVenteId)
    .where('d.is_active', true)
    .sum('ds.quantite as total')

  if (trx) {
    sumQuery = sumQuery.useTransaction(trx)
  }

  const [row] = await sumQuery
  return { produit, quantite: Number(row?.total ?? 0) }
}

export async function verifierStockDisponible(
  produitId: number,
  quantite: number,
  depotId?: number,
  trx?: TransactionClientContract
) {
  const { produit, quantite: disponible } = await getStockDisponible(produitId, depotId, trx)
  if (disponible < quantite) {
    throw new StockInsuffisantError(produit.nom, disponible, quantite)
  }
  return produit
}

export async function enregistrerSortie(
  produitId: number,
  quantite: number,
  motif: MouvementMotif,
  reference: StockReference,
  userId: number,
  trx?: TransactionClientContract,
  notes: string | null = null,
  depotId?: number
) {
  const produit = await getProduitOrFail(produitId, trx)
  const depot = await resolveDepotForProduit(produit, depotId, trx)

  if (!trx) {
    return db.transaction((innerTrx) =>
      enregistrerSortie(produitId, quantite, motif, reference, userId, innerTrx, notes, depot.id)
    )
  }

  const depotStock = await getOrCreateDepotStock(produit.id, depot.id, trx)
  const stockAvant = Number(depotStock.quantite)
  if (stockAvant < quantite) {
    throw new StockInsuffisantError(produit.nom, stockAvant, quantite)
  }

  const stockApres = stockAvant - quantite
  depotStock.quantite = String(stockApres)
  depotStock.useTransaction(trx)
  await depotStock.save()

  await enregistrerMouvement(
    produit,
    depot.id,
    'sortie',
    motif,
    quantite,
    stockApres,
    stockAvant,
    userId,
    reference,
    notes,
    trx
  )

  await produit.refresh()
  return produit
}

export async function enregistrerEntree(
  produitId: number,
  quantite: number,
  motif: MouvementMotif,
  reference: StockReference,
  userId: number,
  trx?: TransactionClientContract,
  notes: string | null = null,
  depotId?: number
) {
  const produit = await getProduitOrFail(produitId, trx)
  const depot = await resolveDepotForProduit(produit, depotId, trx)

  if (!trx) {
    return db.transaction((innerTrx) =>
      enregistrerEntree(produitId, quantite, motif, reference, userId, innerTrx, notes, depot.id)
    )
  }

  const depotStock = await getOrCreateDepotStock(produit.id, depot.id, trx)
  const stockAvant = Number(depotStock.quantite)
  const stockApres = stockAvant + quantite
  depotStock.quantite = String(stockApres)
  depotStock.useTransaction(trx)
  await depotStock.save()

  await enregistrerMouvement(
    produit,
    depot.id,
    'entree',
    motif,
    quantite,
    stockApres,
    stockAvant,
    userId,
    reference,
    notes,
    trx
  )

  await produit.refresh()
  return produit
}

export async function ajustementManuel(
  produitId: number,
  quantite: number,
  type: 'entree' | 'sortie',
  notes: string | null,
  userId: number,
  trx?: TransactionClientContract,
  depotId?: number
) {
  if (type === 'entree') {
    return enregistrerEntree(produitId, quantite, 'ajustement_manuel', {}, userId, trx, notes, depotId)
  }
  return enregistrerSortie(produitId, quantite, 'ajustement_manuel', {}, userId, trx, notes, depotId)
}

export async function enregistrerTransfert(
  produitId: number,
  quantite: number,
  depotSourceId: number,
  depotDestId: number,
  userId: number,
  notes: string | null = null,
  trx?: TransactionClientContract
) {
  if (quantite <= 0) {
    throw new Error('La quantité de transfert doit être positive')
  }

  const run = async (t: TransactionClientContract) => {
    const produit = await getProduitOrFail(produitId, t)
    await assertDepotsMemePointDeVente(produit.pointDeVenteId, depotSourceId, depotDestId, t)

    const sourceStock = await getOrCreateDepotStock(produit.id, depotSourceId, t)
    const destStock = await getOrCreateDepotStock(produit.id, depotDestId, t)
    const stockAvantSource = Number(sourceStock.quantite)

    if (stockAvantSource < quantite) {
      throw new StockInsuffisantError(produit.nom, stockAvantSource, quantite)
    }

    const stockApresSource = stockAvantSource - quantite
    sourceStock.quantite = String(stockApresSource)
    sourceStock.useTransaction(t)
    await sourceStock.save()

    await StockMouvement.create(
      {
        produitId: produit.id,
        depotId: depotSourceId,
        type: 'transfert',
        motif: 'transfert',
        quantite,
        stockAvant: stockAvantSource,
        stockApres: stockApresSource,
        referenceId: depotDestId,
        referenceType: 'transfert_sortie',
        userId,
        notes,
        createdAt: DateTime.now(),
      },
      { client: t }
    )

    const stockAvantDest = Number(destStock.quantite)
    const stockApresDest = stockAvantDest + quantite
    destStock.quantite = String(stockApresDest)
    destStock.useTransaction(t)
    await destStock.save()

    await StockMouvement.create(
      {
        produitId: produit.id,
        depotId: depotDestId,
        type: 'transfert',
        motif: 'transfert',
        quantite,
        stockAvant: stockAvantDest,
        stockApres: stockApresDest,
        referenceId: depotSourceId,
        referenceType: 'transfert_entree',
        userId,
        notes,
        createdAt: DateTime.now(),
      },
      { client: t }
    )

    await syncProduitStockActuel(produit.id, t)
    await produit.refresh()
    return produit
  }

  if (trx) return run(trx)
  return db.transaction(run)
}

async function enregistrerSortieRepartie(
  produitId: number,
  quantite: number,
  motif: MouvementMotif,
  reference: StockReference,
  userId: number,
  trx: TransactionClientContract,
  notes: string | null
) {
  const { produit, quantite: total } = await getStockTotalDisponible(produitId, trx)
  if (total < quantite) {
    throw new StockInsuffisantError(produit.nom, total, quantite)
  }

  const defaultDepot = await getDefaultDepot(produit.pointDeVenteId, trx)
  const stocks = await DepotStock.query({ client: trx })
    .where('produit_id', produitId)
    .where('quantite', '>', 0)
    .whereIn('depot_id', (sub) => {
      sub
        .from('depots')
        .select('id')
        .where('point_de_vente_id', produit.pointDeVenteId)
        .where('is_active', true)
    })
    .orderByRaw('CASE WHEN depot_id = ? THEN 0 ELSE 1 END', [defaultDepot.id])
    .orderBy('depot_id', 'asc')

  let remaining = quantite
  for (const stock of stocks) {
    if (remaining <= 0) break
    const depotQty = Number(stock.quantite)
    const toDeduct = Math.min(remaining, depotQty)
    await enregistrerSortie(produitId, toDeduct, motif, reference, userId, trx, notes, stock.depotId)
    remaining -= toDeduct
  }
}

export async function inventaireStock(
  produitId: number,
  quantiteComptee: number,
  notes: string | null,
  userId: number,
  trx?: TransactionClientContract
) {
  const run = async (t: TransactionClientContract) => {
    const { produit, quantite: actuel } = await getStockTotalDisponible(produitId, t)
    const delta = quantiteComptee - actuel

    if (delta === 0) {
      await produit.refresh()
      return produit
    }

    if (delta > 0) {
      return enregistrerEntree(
        produitId,
        delta,
        'inventaire',
        { referenceType: 'inventaire' },
        userId,
        t,
        notes
      )
    }

    await enregistrerSortieRepartie(
      produitId,
      Math.abs(delta),
      'inventaire',
      { referenceType: 'inventaire' },
      userId,
      t,
      notes
    )
    await produit.refresh()
    return produit
  }

  if (trx) return run(trx)
  return db.transaction(run)
}

export async function perteStock(
  produitId: number,
  quantite: number,
  notes: string | null,
  userId: number,
  trx?: TransactionClientContract
) {
  const run = async (t: TransactionClientContract) => {
    await enregistrerSortieRepartie(
      produitId,
      quantite,
      'perte',
      { referenceType: 'perte' },
      userId,
      t,
      notes
    )
    const produit = await getProduitOrFail(produitId, t)
    await produit.refresh()
    return produit
  }

  if (trx) return run(trx)
  return db.transaction(run)
}

export type StockMouvementFilters = {
  page?: number
  limit?: number
  produitId?: number
  depotId?: number
  type?: string
  motif?: string
  dateFrom?: DateTime
  dateTo?: DateTime
}

export async function getValorisation(pointDeVenteId: number) {
  const totalRow = await db
    .from('depot_stocks as ds')
    .join('depots as d', 'd.id', 'ds.depot_id')
    .join('produits as p', 'p.id', 'ds.produit_id')
    .where('p.is_active', true)
    .where('d.point_de_vente_id', pointDeVenteId)
    .where('d.is_active', true)
    .select(db.raw('SUM(ds.quantite * p.prix_achat_ht) as total'))

  const parCategorie = await db
    .from('depot_stocks as ds')
    .join('depots as d', 'd.id', 'ds.depot_id')
    .join('produits as p', 'p.id', 'ds.produit_id')
    .leftJoin('categories', 'p.categorie_id', 'categories.id')
    .where('p.is_active', true)
    .where('d.point_de_vente_id', pointDeVenteId)
    .where('d.is_active', true)
    .groupBy('categories.id', 'categories.nom')
    .select(
      'categories.id as categorie_id',
      'categories.nom as categorie_nom',
      db.raw('SUM(ds.quantite * p.prix_achat_ht) as valeur')
    )
    .orderBy('valeur', 'desc')

  return {
    totalValeur: Number(totalRow[0]?.total ?? 0),
    parCategorie: parCategorie.map((row) => ({
      categorieId: row.categorie_id ?? null,
      categorieNom: row.categorie_nom ?? 'Sans catégorie',
      valeur: Number(row.valeur ?? 0),
    })),
  }
}

export async function searchMouvements(
  pointDeVenteId: number,
  filters: StockMouvementFilters = {}
) {
  const { page, limit, offset } = parsePagination(filters)

  const query = StockMouvement.query()
    .whereIn('produit_id', (sub) => {
      sub.from('produits').select('id').where('point_de_vente_id', pointDeVenteId)
    })
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')

  if (filters.produitId) query.where('produit_id', filters.produitId)
  if (filters.depotId) query.where('depot_id', filters.depotId)
  if (filters.type) query.where('type', filters.type)
  if (filters.motif) query.where('motif', filters.motif)
  if (filters.dateFrom) query.where('created_at', '>=', filters.dateFrom.startOf('day').toSQL()!)
  if (filters.dateTo) query.where('created_at', '<=', filters.dateTo.endOf('day').toSQL()!)

  const total = await query.clone().count('* as total')
  const mouvements = await query.offset(offset).limit(limit)

  return {
    data: mouvements,
    meta: buildMeta(Number(total[0].$extras.total), page, limit),
  }
}
