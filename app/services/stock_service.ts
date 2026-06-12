import Produit from '#models/produit'
import StockMouvement from '#models/stock_mouvement'
import { buildMeta, parsePagination } from '#helpers/pagination'
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

async function getProduitOrFail(produitId: number, trx?: TransactionClientContract) {
  const query = trx ? Produit.query({ client: trx }) : Produit.query()
  const produit = await query.where('id', produitId).first()
  if (!produit) throw new Error(`Produit ${produitId} introuvable`)
  return produit
}

async function enregistrerMouvement(
  produit: Produit,
  type: MouvementType,
  motif: MouvementMotif,
  quantite: number,
  stockApres: number,
  userId: number,
  reference: StockReference,
  notes: string | null,
  trx?: TransactionClientContract
) {
  const stockAvant = Number(produit.stockActuel)
  await StockMouvement.create(
    {
      produitId: produit.id,
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

  produit.stockActuel = stockApres
  if (trx) {
    produit.useTransaction(trx)
  }
  await produit.save()
}

export async function verifierStockDisponible(produitId: number, quantite: number) {
  const produit = await getProduitOrFail(produitId)
  const disponible = Number(produit.stockActuel)
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
  notes: string | null = null
) {
  const produit = await getProduitOrFail(produitId, trx)
  const stockAvant = Number(produit.stockActuel)
  if (stockAvant < quantite) {
    throw new StockInsuffisantError(produit.nom, stockAvant, quantite)
  }
  const stockApres = stockAvant - quantite
  await enregistrerMouvement(produit, 'sortie', motif, quantite, stockApres, userId, reference, notes, trx)
  return produit
}

export async function enregistrerEntree(
  produitId: number,
  quantite: number,
  motif: MouvementMotif,
  reference: StockReference,
  userId: number,
  trx?: TransactionClientContract,
  notes: string | null = null
) {
  const produit = await getProduitOrFail(produitId, trx)
  const stockApres = Number(produit.stockActuel) + quantite
  await enregistrerMouvement(produit, 'entree', motif, quantite, stockApres, userId, reference, notes, trx)
  return produit
}

export async function ajustementManuel(
  produitId: number,
  quantite: number,
  type: 'entree' | 'sortie',
  notes: string | null,
  userId: number,
  trx?: TransactionClientContract
) {
  if (type === 'entree') {
    return enregistrerEntree(produitId, quantite, 'ajustement_manuel', {}, userId, trx, notes)
  }
  return enregistrerSortie(produitId, quantite, 'ajustement_manuel', {}, userId, trx, notes)
}

export type StockMouvementFilters = {
  page?: number
  limit?: number
  produitId?: number
  type?: string
  motif?: string
  dateFrom?: DateTime
  dateTo?: DateTime
}

export async function getValorisation(pointDeVenteId: number) {
  const totalRow = await db
    .from('produits')
    .where('is_active', true)
    .where('point_de_vente_id', pointDeVenteId)
    .select(db.raw('SUM(stock_actuel * prix_achat_ht) as total'))

  const parCategorie = await db
    .from('produits')
    .leftJoin('categories', 'produits.categorie_id', 'categories.id')
    .where('produits.is_active', true)
    .where('produits.point_de_vente_id', pointDeVenteId)
    .groupBy('categories.id', 'categories.nom')
    .select(
      'categories.id as categorie_id',
      'categories.nom as categorie_nom',
      db.raw('SUM(produits.stock_actuel * produits.prix_achat_ht) as valeur')
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
  if (filters.type) query.where('type', filters.type)
  if (filters.motif) query.where('motif', filters.motif)
  if (filters.dateFrom) query.where('created_at', '>=', filters.dateFrom.toSQL()!)
  if (filters.dateTo) query.where('created_at', '<=', filters.dateTo.endOf('day').toSQL()!)

  const total = await query.clone().count('* as total')
  const mouvements = await query.offset(offset).limit(limit)

  return {
    data: mouvements,
    meta: buildMeta(Number(total[0].$extras.total), page, limit),
  }
}
