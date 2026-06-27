import Category from '#models/category'
import Depot from '#models/depot'
import Produit from '#models/produit'
import User from '#models/user'
import { sendError, sendPaginated, sendSuccess } from '#helpers/api_response'
import { assertRecordBelongsToPointDeVente, requirePointDeVente, scopeByPointDeVente } from '#helpers/point_de_vente_context'
import { buildMeta, parsePagination } from '#helpers/pagination'
import { applyLowStockAlertFilter, applyStockAlertFilter, applyStockAlertFilterForDepot, getStockStatus } from '#helpers/produit_query'
import { serializeProduit } from '#helpers/produit_serializer'
import { getStocksParDepotForProduits } from '#services/depot_service'
import { roundMoney } from '#services/pricing_service'
import { getValorisation, inventaireStock, perteStock, searchMouvements } from '#services/stock_service'
import {
  enregistrerSaisieInventaire,
  getInventaireGrille,
  getInventaireSaisieDetail,
  InventaireSaisieError,
  searchInventaireSaisies,
  StockInsuffisantError as InventaireStockInsuffisantError,
} from '#services/inventaire_saisie_service'
import { resolveStockDisplay } from '#services/vente_unite_service'
import {
  stockAlertesValidator,
  stockInventaireGrilleValidator,
  stockInventaireSaisieIdValidator,
  stockInventaireSaisieSearchValidator,
  stockInventaireSaisieValidator,
  stockInventaireValidator,
  stockMouvementsSearchValidator,
  stockPerteValidator,
  stockSearchValidator,
} from '#validators/stock_validator'
import type { HttpContext } from '@adonisjs/core/http'

function serializeStockProduit(
  produit: Produit,
  extras: Record<string, unknown> = {},
  options?: Parameters<typeof serializeProduit>[2] & { depotId?: number }
) {
  const stocksParDepot = options?.stocksParDepot ?? []
  const base = serializeProduit(produit, extras, options)
  const stockActuel = Number(produit.stockActuel)
  const prixAchatHt = Number(produit.prixAchatHt)

  if (!options?.depotId) {
    return {
      ...base,
      valeurStock: roundMoney(stockActuel * prixAchatHt),
    }
  }

  const depotStock = stocksParDepot.find((s) => s.depot_id === options.depotId)
  const depotQty = depotStock?.quantite ?? 0
  const stockDisplay = resolveStockDisplay(produit, depotQty)
  const stockMinimum = Number(produit.stockMinimum)
  const stockMaximum = Number(produit.stockMaximum)

  return {
    ...base,
    stockActuel: depotQty,
    stockDetail: stockDisplay.stockDetail,
    stockPieces: stockDisplay.stockPieces,
    stockResteDetail: stockDisplay.stockResteDetail,
    stockLabel: stockDisplay.stockLabel,
    stockStatus:
      depotStock?.stock_status ?? getStockStatus(depotQty, stockMinimum, stockMaximum),
    valeurStock: roundMoney(depotQty * prixAchatHt),
  }
}

export default class StockController {
  async search(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(stockSearchValidator)
    const { page, limit, offset } = parsePagination(payload)

    const pos = requirePointDeVente(ctx)

    if (payload.depot_id) {
      const depot = await Depot.find(payload.depot_id)
      if (!(await assertRecordBelongsToPointDeVente(ctx, depot, 'Dépôt'))) return
    }

    const query = scopeByPointDeVente(Produit.query().orderBy('nom', 'asc'), pos.pointDeVenteId)

    if (payload.categorie_id) query.where('categorie_id', payload.categorie_id)
    if (payload.is_active !== undefined) query.where('is_active', payload.is_active)
    if (payload.stock_alert) {
      if (payload.depot_id) {
        applyStockAlertFilterForDepot(query, payload.stock_alert, payload.depot_id)
      } else {
        applyStockAlertFilter(query, payload.stock_alert)
      }
    }
    if (payload.search) {
      const term = `%${payload.search}%`
      query.where((q) => {
        q.whereILike('nom', term).orWhereILike('code', term)
      })
    }

    const total = await query.clone().count('* as total')
    const produits = await query.offset(offset).limit(limit)
    const stocksMap = await getStocksParDepotForProduits(produits.map((p) => p.id))

    const categorieIds = [...new Set(produits.map((p) => p.categorieId).filter(Boolean))] as number[]
    const categorieMap = new Map(
      categorieIds.length > 0
        ? (await Category.query().whereIn('id', categorieIds)).map((c) => [c.id, c.serialize()])
        : []
    )

    return sendPaginated(
      ctx,
      produits.map((p) =>
        serializeStockProduit(
          p,
          {
            categorie: p.categorieId ? categorieMap.get(p.categorieId) ?? null : null,
          },
          { stocksParDepot: stocksMap.get(p.id) ?? [], depotId: payload.depot_id }
        )
      ),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }

  async mouvementsSearch(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(stockMouvementsSearchValidator)
    const dateFrom = payload.date_debut ?? payload.date_from
    const dateTo = payload.date_fin ?? payload.date_to

    if (dateFrom && dateTo && dateFrom > dateTo) {
      return sendError(ctx, 'date_debut doit être antérieure ou égale à date_fin', 422)
    }

    const pos = requirePointDeVente(ctx)
    const result = await searchMouvements(pos.pointDeVenteId, {
      page: payload.page,
      limit: payload.limit,
      produitId: payload.produit_id,
      depotId: payload.depot_id,
      type: payload.type,
      motif: payload.motif,
      dateFrom,
      dateTo,
    })

    const produitIds = [...new Set(result.data.map((m) => m.produitId))]
    const userIds = [...new Set(result.data.map((m) => m.userId))]

    const [produitMap, userMap] = await Promise.all([
      produitIds.length > 0
        ? new Map(
            (await Produit.query().whereIn('id', produitIds)).map((p) => [
              p.id,
              { id: p.id, code: p.code, nom: p.nom },
            ])
          )
        : new Map<number, { id: number; code: string; nom: string }>(),
      userIds.length > 0
        ? new Map(
            (await User.query().whereIn('id', userIds)).map((u) => [
              u.id,
              { id: u.id, nom: u.nom, prenom: u.prenom },
            ])
          )
        : new Map<number, { id: number; nom: string | null; prenom: string | null }>(),
    ])

    const mouvements = result.data.map((m) => ({
      ...m.serialize(),
      produit: produitMap.get(m.produitId) ?? null,
      user: userMap.get(m.userId) ?? null,
    }))

    return sendSuccess(ctx, { mouvements }, result.meta)
  }

  async valorisation(ctx: HttpContext) {
    const pos = requirePointDeVente(ctx)
    const valorisation = await getValorisation(pos.pointDeVenteId)
    return sendSuccess(ctx, valorisation)
  }

  async alertes(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(stockAlertesValidator)
    const { page, limit, offset } = parsePagination(payload)
    const pos = requirePointDeVente(ctx)

    const query = scopeByPointDeVente(
      Produit.query()
        .where('is_active', true)
        .orderBy('stock_actuel', 'asc'),
      pos.pointDeVenteId
    )
    applyLowStockAlertFilter(query, payload.depot_id)

    const total = await query.clone().count('* as total')
    const produits = await query.offset(offset).limit(limit)
    const stocksMap = await getStocksParDepotForProduits(produits.map((p) => p.id))

    return sendPaginated(
      ctx,
      produits.map((p) =>
        serializeStockProduit(p, {}, { stocksParDepot: stocksMap.get(p.id) ?? [] })
      ),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }

  async inventaire(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(stockInventaireValidator)
    const produit = await Produit.find(payload.produit_id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, produit, 'Produit'))) return

    const updated = await inventaireStock(
      payload.produit_id,
      payload.quantite_comptee,
      payload.notes ?? null,
      ctx.auth.getUserOrFail().id
    )

    return sendSuccess(ctx, {
      message: 'Inventaire enregistré',
      produit: serializeProduit(updated),
    })
  }

  async perte(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(stockPerteValidator)
    const produit = await Produit.find(payload.produit_id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, produit, 'Produit'))) return

    try {
      const updated = await perteStock(
        payload.produit_id,
        payload.quantite,
        payload.notes ?? null,
        ctx.auth.getUserOrFail().id
      )
      return sendSuccess(ctx, {
        message: 'Perte enregistrée',
        produit: serializeProduit(updated),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'StockInsuffisantError') {
        return sendError(ctx, error.message, 422)
      }
      throw error
    }
  }

  /** Grille saisie inventaire : code, désignation, dépôt, quantité actuelle */
  async inventaireGrille(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(stockInventaireGrilleValidator)
    const pos = requirePointDeVente(ctx)

    try {
      const result = await getInventaireGrille(pos.pointDeVenteId, payload)
      return sendSuccess(ctx, result, result.meta)
    } catch (error) {
      if (error instanceof InventaireSaisieError) {
        return sendError(ctx, error.message, 422)
      }
      throw error
    }
  }

  /** Enregistre une saisie inventaire (entrées / sorties par ligne) */
  async inventaireSaisie(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(stockInventaireSaisieValidator)
    const pos = requirePointDeVente(ctx)

    const depot = await Depot.find(payload.depot_id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, depot, 'Dépôt'))) return

    try {
      const { saisie, lignes } = await enregistrerSaisieInventaire(
        pos.pointDeVenteId,
        payload.depot_id,
        payload.lignes,
        ctx.auth.getUserOrFail().id,
        payload.notes ?? null,
        payload.date_saisie
      )

      return sendSuccess(ctx, {
        message: 'Saisie inventaire enregistrée',
        saisie: {
          ...saisie.serialize(),
          total_entree: Number(saisie.totalEntree),
          total_sortie: Number(saisie.totalSortie),
          valeur_entree: Number(saisie.valeurEntree),
          valeur_sortie: Number(saisie.valeurSortie),
        },
        depot: depot ? { id: depot.id, code: depot.code, nom: depot.nom } : null,
        lignes: lignes.map((ligne) => ({
          ...ligne.serialize(),
          quantite_actuelle: Number(ligne.quantiteActuelle),
          entree: Number(ligne.entree),
          sortie: Number(ligne.sortie),
          stock_apres: Number(ligne.stockApres),
          valeur_entree: Number(ligne.valeurEntree),
          valeur_sortie: Number(ligne.valeurSortie),
        })),
      })
    } catch (error) {
      if (error instanceof InventaireSaisieError) {
        return sendError(ctx, error.message, 422)
      }
      if (error instanceof InventaireStockInsuffisantError) {
        return sendError(ctx, error.message, 422)
      }
      throw error
    }
  }

  async inventaireSaisieSearch(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(stockInventaireSaisieSearchValidator)
    const pos = requirePointDeVente(ctx)

    const result = await searchInventaireSaisies(pos.pointDeVenteId, {
      page: payload.page,
      limit: payload.limit,
      depot_id: payload.depot_id,
      date_from: payload.date_from,
      date_to: payload.date_to,
    })

    const depotIds = [...new Set(result.data.map((s) => s.depotId))]
    const depots = depotIds.length
      ? await Depot.query().whereIn('id', depotIds)
      : []
    const depotMap = new Map(depots.map((d) => [d.id, d]))

    const data = result.data.map((saisie) => ({
      ...saisie.serialize(),
      total_entree: Number(saisie.totalEntree),
      total_sortie: Number(saisie.totalSortie),
      valeur_entree: Number(saisie.valeurEntree),
      valeur_sortie: Number(saisie.valeurSortie),
      depot: depotMap.get(saisie.depotId)
        ? {
            id: depotMap.get(saisie.depotId)!.id,
            code: depotMap.get(saisie.depotId)!.code,
            nom: depotMap.get(saisie.depotId)!.nom,
          }
        : null,
    }))

    return sendSuccess(ctx, { saisies: data }, result.meta)
  }

  async inventaireSaisieShow(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(stockInventaireSaisieIdValidator)
    const pos = requirePointDeVente(ctx)

    const detail = await getInventaireSaisieDetail(pos.pointDeVenteId, id)
    if (!detail) return sendError(ctx, 'Saisie inventaire introuvable', 404)

    const { saisie, depot, lignes } = detail

    return sendSuccess(ctx, {
      saisie: {
        ...saisie.serialize(),
        total_entree: Number(saisie.totalEntree),
        total_sortie: Number(saisie.totalSortie),
        valeur_entree: Number(saisie.valeurEntree),
        valeur_sortie: Number(saisie.valeurSortie),
      },
      depot: depot ? { id: depot.id, code: depot.code, nom: depot.nom } : null,
      lignes: lignes.map((ligne) => ({
        ...ligne.serialize(),
        quantite_actuelle: Number(ligne.quantiteActuelle),
        entree: Number(ligne.entree),
        sortie: Number(ligne.sortie),
        stock_apres: Number(ligne.stockApres),
        valeur_entree: Number(ligne.valeurEntree),
        valeur_sortie: Number(ligne.valeurSortie),
      })),
    })
  }
}
