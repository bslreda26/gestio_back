import Depot from '#models/depot'
import InventaireSaisie from '#models/inventaire_saisie'
import InventaireSaisieLigne from '#models/inventaire_saisie_ligne'
import Produit from '#models/produit'
import { buildMeta, parsePagination } from '#helpers/pagination'
import { getStocksParDepotForProduits } from '#services/depot_service'
import { roundMoney } from '#services/pricing_service'
import {
  enregistrerEntree,
  enregistrerSortie,
  getStockDisponible,
  StockInsuffisantError,
} from '#services/stock_service'
import {
  AjustementQuantiteError,
  canVenteAuDetail,
  hasUniteDetailConfig,
  resolveAjustementQuantite,
  resolveStockDisplay,
  type ModeVente,
} from '#services/vente_unite_service'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export type InventaireSaisieLigneInput = {
  produit_id: number
  entree?: number
  sortie?: number
  mode_vente_entree?: ModeVente
  mode_vente_sortie?: ModeVente
}

export type InventaireGrilleFilters = {
  page?: number
  limit?: number
  depot_id: number
  search?: string
  categorie_id?: number
}

export class InventaireSaisieError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InventaireSaisieError'
  }
}

function resolveInventaireMouvementQuantite(
  produit: Produit,
  quantite: number,
  mode?: ModeVente
): number {
  if (quantite <= 0) return 0
  try {
    return resolveAjustementQuantite(produit, {
      quantite,
      mode_vente: mode ?? 'detail',
    })
  } catch (error) {
    if (error instanceof AjustementQuantiteError) {
      throw new InventaireSaisieError(error.message)
    }
    throw error
  }
}

function produitSupportsModeVente(produit: Produit): boolean {
  return hasUniteDetailConfig(produit) || canVenteAuDetail(produit)
}

export async function getInventaireGrille(pointDeVenteId: number, filters: InventaireGrilleFilters) {
  const { page, limit, offset } = parsePagination(filters)

  const depot = await Depot.query()
    .where('id', filters.depot_id)
    .where('point_de_vente_id', pointDeVenteId)
    .where('is_active', true)
    .first()

  if (!depot) {
    throw new InventaireSaisieError('Dépôt introuvable')
  }

  const query = Produit.query()
    .where('point_de_vente_id', pointDeVenteId)
    .where('is_active', true)
    .orderBy('nom', 'asc')

  if (filters.categorie_id) query.where('categorie_id', filters.categorie_id)
  if (filters.search) {
    const term = `%${filters.search}%`
    query.where((q) => {
      q.whereILike('nom', term).orWhereILike('code', term)
    })
  }

  const total = await query.clone().count('* as total')
  const produits = await query.offset(offset).limit(limit)
  const stocksMap = await getStocksParDepotForProduits(produits.map((p) => p.id))

  const lignes = produits.map((produit) => {
    const stocksParDepot = stocksMap.get(produit.id) ?? []
    const depotStock = stocksParDepot.find((s) => s.depot_id === depot.id)
    const quantiteActuelle = depotStock?.quantite ?? 0
    const stockDisplay = resolveStockDisplay(produit, quantiteActuelle)
    const stockTotalDetail = Number(produit.stockActuel)
    const stockTotalDisplay = resolveStockDisplay(produit, stockTotalDetail)
    const prixAchatHt = Number(produit.prixAchatHt)

    return {
      produit_id: produit.id,
      code: produit.code,
      designation: produit.nom,
      depot: { id: depot.id, code: depot.code, nom: depot.nom },
      /** Stock dans le dépôt sélectionné (unité détail) */
      quantite_actuelle: stockDisplay.stockDetail,
      /** Libellé stock du dépôt sélectionné — ex. « 30 kg » ou « 176 sac + 30 kg » */
      quantite_actuelle_label: stockDisplay.stockLabel,
      stock_label: stockDisplay.stockLabel,
      stock_pieces: stockDisplay.stockPieces,
      stock_reste_detail: stockDisplay.stockResteDetail,
      /** Stock total tous dépôts (ce que affiche le catalogue / stock sans filtre dépôt) */
      stock_total: stockTotalDisplay.stockDetail,
      stock_total_label: stockTotalDisplay.stockLabel,
      stock_total_pieces: stockTotalDisplay.stockPieces,
      stock_total_reste_detail: stockTotalDisplay.stockResteDetail,
      stocks_par_depot: stocksParDepot.map((s) => ({
        depot_id: s.depot_id,
        depot_code: s.depot_code,
        depot_nom: s.depot_nom,
        quantite: s.quantite,
        stock_label: s.stock_label,
      })),
      entree: 0,
      sortie: 0,
      contenance: Number(produit.contenance ?? 1),
      unite: produit.unite ?? null,
      unite_gros: produit.uniteGros ?? null,
      vente_au_detail: produit.venteAuDetail ?? false,
      vente_detail_disponible: hasUniteDetailConfig(produit),
      prix_achat_ht: prixAchatHt,
      valeur_stock: roundMoney(stockDisplay.stockDetail * prixAchatHt),
      valeur_stock_total: roundMoney(stockTotalDetail * prixAchatHt),
    }
  })

  return {
    depot: { id: depot.id, code: depot.code, nom: depot.nom },
    lignes,
    meta: buildMeta(Number(total[0].$extras.total), page, limit),
  }
}

export async function enregistrerSaisieInventaire(
  pointDeVenteId: number,
  depotId: number,
  lignesInput: InventaireSaisieLigneInput[],
  userId: number,
  notes: string | null = null,
  dateSaisie?: DateTime
) {
  const depot = await Depot.query()
    .where('id', depotId)
    .where('point_de_vente_id', pointDeVenteId)
    .where('is_active', true)
    .first()

  if (!depot) {
    throw new InventaireSaisieError('Dépôt introuvable')
  }

  const lignesActives = lignesInput
    .map((ligne) => ({
      produit_id: ligne.produit_id,
      entree: Number(ligne.entree ?? 0),
      sortie: Number(ligne.sortie ?? 0),
      mode_vente_entree: ligne.mode_vente_entree,
      mode_vente_sortie: ligne.mode_vente_sortie,
    }))
    .filter((ligne) => ligne.entree > 0 || ligne.sortie > 0)

  if (lignesActives.length === 0) {
    throw new InventaireSaisieError('Aucune ligne avec entrée ou sortie à enregistrer')
  }

  const produitIds = [...new Set(lignesActives.map((l) => l.produit_id))]
  const produits = await Produit.query()
    .whereIn('id', produitIds)
    .where('point_de_vente_id', pointDeVenteId)

  const produitMap = new Map(produits.map((p) => [p.id, p]))
  for (const ligne of lignesActives) {
    if (!produitMap.has(ligne.produit_id)) {
      throw new InventaireSaisieError(`Produit ${ligne.produit_id} introuvable`)
    }
    if (ligne.entree < 0 || ligne.sortie < 0) {
      throw new InventaireSaisieError('Les quantités entrée et sortie doivent être positives')
    }
  }

  return db.transaction(async (trx) => {
    const saisie = await InventaireSaisie.create(
      {
        pointDeVenteId,
        depotId,
        userId,
        dateSaisie: dateSaisie ?? DateTime.now(),
        notes,
        totalEntree: '0',
        totalSortie: '0',
        valeurEntree: '0',
        valeurSortie: '0',
        lignesCount: 0,
      },
      { client: trx }
    )

    const reference = { referenceId: saisie.id, referenceType: 'inventaire_saisie' }
    let totalEntree = 0
    let totalSortie = 0
    let valeurEntree = 0
    let valeurSortie = 0
    const savedLignes: InventaireSaisieLigne[] = []

    for (const input of lignesActives) {
      const produit = produitMap.get(input.produit_id)!
      const { quantite: quantiteActuelle } = await getStockDisponible(produit.id, depotId, trx)
      const prixAchatHt = Number(produit.prixAchatHt)
      let stockCourant = quantiteActuelle

      const modeEntree =
        input.entree > 0 && produitSupportsModeVente(produit)
          ? (input.mode_vente_entree ?? 'piece')
          : undefined
      const modeSortie =
        input.sortie > 0 && produitSupportsModeVente(produit)
          ? (input.mode_vente_sortie ?? 'piece')
          : undefined

      const entreeStock = resolveInventaireMouvementQuantite(produit, input.entree, modeEntree)
      const sortieStock = resolveInventaireMouvementQuantite(produit, input.sortie, modeSortie)

      if (input.entree > 0) {
        await enregistrerEntree(
          produit.id,
          entreeStock,
          'inventaire',
          reference,
          userId,
          trx,
          notes,
          depotId
        )
        stockCourant += entreeStock
        totalEntree += entreeStock
        valeurEntree += roundMoney(entreeStock * prixAchatHt)
      }

      if (input.sortie > 0) {
        await enregistrerSortie(
          produit.id,
          sortieStock,
          'inventaire',
          reference,
          userId,
          trx,
          notes,
          depotId
        )
        stockCourant -= sortieStock
        totalSortie += sortieStock
        valeurSortie += roundMoney(sortieStock * prixAchatHt)
      }

      const ligne = await InventaireSaisieLigne.create(
        {
          inventaireSaisieId: saisie.id,
          produitId: produit.id,
          code: produit.code,
          designation: produit.nom,
          quantiteActuelle: String(quantiteActuelle),
          entree: String(input.entree),
          sortie: String(input.sortie),
          modeVenteEntree: modeEntree ?? null,
          modeVenteSortie: modeSortie ?? null,
          stockApres: String(stockCourant),
          prixAchatHt: String(prixAchatHt),
          valeurEntree: String(roundMoney(input.entree > 0 ? entreeStock * prixAchatHt : 0)),
          valeurSortie: String(roundMoney(input.sortie > 0 ? sortieStock * prixAchatHt : 0)),
        },
        { client: trx }
      )
      savedLignes.push(ligne)
    }

    saisie.totalEntree = String(totalEntree)
    saisie.totalSortie = String(totalSortie)
    saisie.valeurEntree = String(roundMoney(valeurEntree))
    saisie.valeurSortie = String(roundMoney(valeurSortie))
    saisie.lignesCount = savedLignes.length
    saisie.useTransaction(trx)
    await saisie.save()

    return { saisie, lignes: savedLignes }
  })
}

export async function searchInventaireSaisies(
  pointDeVenteId: number,
  filters: { page?: number; limit?: number; depot_id?: number; date_from?: DateTime; date_to?: DateTime }
) {
  const { page, limit, offset } = parsePagination(filters)

  const query = InventaireSaisie.query()
    .where('point_de_vente_id', pointDeVenteId)
    .orderBy('date_saisie', 'desc')
    .orderBy('id', 'desc')

  if (filters.depot_id) query.where('depot_id', filters.depot_id)
  if (filters.date_from) query.where('date_saisie', '>=', filters.date_from.toISODate()!)
  if (filters.date_to) query.where('date_saisie', '<=', filters.date_to.toISODate()!)

  const total = await query.clone().count('* as total')
  const saisies = await query.offset(offset).limit(limit)

  return {
    data: saisies,
    meta: buildMeta(Number(total[0].$extras.total), page, limit),
  }
}

export async function getInventaireSaisieDetail(pointDeVenteId: number, id: number) {
  const saisie = await InventaireSaisie.query()
    .where('id', id)
    .where('point_de_vente_id', pointDeVenteId)
    .first()

  if (!saisie) return null

  const [depot, lignes] = await Promise.all([
    Depot.find(saisie.depotId),
    InventaireSaisieLigne.query().where('inventaire_saisie_id', id).orderBy('id', 'asc'),
  ])

  return { saisie, depot, lignes }
}

export { StockInsuffisantError }
