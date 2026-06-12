import Category from '#models/category'
import Produit from '#models/produit'
import User from '#models/user'
import { sendPaginated, sendSuccess } from '#helpers/api_response'
import { requirePointDeVente, scopeByPointDeVente } from '#helpers/point_de_vente_context'
import { buildMeta, parsePagination } from '#helpers/pagination'
import { applyStockAlertFilter } from '#helpers/produit_query'
import { serializeProduit } from '#helpers/produit_serializer'
import { roundMoney } from '#services/pricing_service'
import { getValorisation, searchMouvements } from '#services/stock_service'
import {
  stockAlertesValidator,
  stockMouvementsSearchValidator,
  stockSearchValidator,
} from '#validators/stock_validator'
import type { HttpContext } from '@adonisjs/core/http'

function serializeStockProduit(produit: Produit, extras: Record<string, unknown> = {}) {
  const base = serializeProduit(produit, extras)
  const stockActuel = Number(produit.stockActuel)
  const prixAchatHt = Number(produit.prixAchatHt)
  return {
    ...base,
    valeurStock: roundMoney(stockActuel * prixAchatHt),
  }
}

export default class StockController {
  async search(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(stockSearchValidator)
    const { page, limit, offset } = parsePagination(payload)

    const pos = requirePointDeVente(ctx)
    const query = scopeByPointDeVente(Produit.query().orderBy('nom', 'asc'), pos.pointDeVenteId)

    if (payload.categorie_id) query.where('categorie_id', payload.categorie_id)
    if (payload.is_active !== undefined) query.where('is_active', payload.is_active)
    if (payload.stock_alert) applyStockAlertFilter(query, payload.stock_alert)
    if (payload.search) {
      const term = `%${payload.search}%`
      query.where((q) => {
        q.whereILike('nom', term).orWhereILike('code', term)
      })
    }

    const total = await query.clone().count('* as total')
    const produits = await query.offset(offset).limit(limit)

    const categorieIds = [...new Set(produits.map((p) => p.categorieId).filter(Boolean))] as number[]
    const categorieMap = new Map(
      categorieIds.length > 0
        ? (await Category.query().whereIn('id', categorieIds)).map((c) => [c.id, c.serialize()])
        : []
    )

    return sendPaginated(
      ctx,
      produits.map((p) =>
        serializeStockProduit(p, {
          categorie: p.categorieId ? categorieMap.get(p.categorieId) ?? null : null,
        })
      ),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }

  async mouvementsSearch(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(stockMouvementsSearchValidator)
    const pos = requirePointDeVente(ctx)
    const result = await searchMouvements(pos.pointDeVenteId, {
      page: payload.page,
      limit: payload.limit,
      produitId: payload.produit_id,
      type: payload.type,
      motif: payload.motif,
      dateFrom: payload.date_from,
      dateTo: payload.date_to,
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
        .whereRaw('stock_actuel <= stock_minimum')
        .orderBy('stock_actuel', 'asc'),
      pos.pointDeVenteId
    )

    const total = await query.clone().count('* as total')
    const produits = await query.offset(offset).limit(limit)

    return sendPaginated(
      ctx,
      produits.map((p) => serializeStockProduit(p)),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }
}
