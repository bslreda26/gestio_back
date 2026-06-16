import PointDeVente from '#models/point_de_vente'
import { sendError, sendPaginated, sendSuccess } from '#helpers/api_response'
import { buildMeta, parsePagination } from '#helpers/pagination'
import { creerPointDeVente } from '#services/point_de_vente_service'
import {
  pointDeVenteCreateValidator,
  pointDeVenteIdValidator,
  pointDeVenteSearchValidator,
  pointDeVenteUpdateValidator,
} from '#validators/point_de_vente_validator'
import type { HttpContext } from '@adonisjs/core/http'

function serializePointDeVente(pos: PointDeVente) {
  return {
    id: pos.id,
    code: pos.code,
    nom: pos.nom,
    adresse: pos.adresse,
    ville: pos.ville,
    telephone: pos.telephone,
    point_of_sale: pos.pointOfSale,
    establishment: pos.establishment,
    timbre_reference: pos.timbreReference,
    is_active: pos.isActive,
    created_at: pos.createdAt,
    updated_at: pos.updatedAt,
  }
}

export default class PointsDeVenteController {
  async search(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(pointDeVenteSearchValidator)
    const { page, limit, offset } = parsePagination(payload)

    const query = PointDeVente.query().orderBy('code', 'asc')

    if (payload.nom) query.whereILike('nom', `%${payload.nom}%`)
    if (payload.code) query.whereILike('code', `%${payload.code}%`)
    if (payload.ville) query.whereILike('ville', `%${payload.ville}%`)
    if (payload.is_active !== undefined) query.where('is_active', payload.is_active)
    if (payload.search) {
      const term = `%${payload.search}%`
      query.where((q) => {
        q.whereILike('nom', term).orWhereILike('code', term).orWhereILike('ville', term)
      })
    }

    const total = await query.clone().count('* as total')
    const points = await query.offset(offset).limit(limit)

    return sendPaginated(
      ctx,
      points.map(serializePointDeVente),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }

  async show(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(pointDeVenteIdValidator)
    const pos = await PointDeVente.find(id)
    if (!pos) return sendError(ctx, 'Point de vente introuvable', 404)

    return sendSuccess(ctx, serializePointDeVente(pos))
  }

  async create(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(pointDeVenteCreateValidator)

    const pos = await creerPointDeVente({
      code: payload.code,
      nom: payload.nom,
      adresse: payload.adresse,
      ville: payload.ville,
      telephone: payload.telephone,
      point_of_sale: payload.point_of_sale,
      establishment: payload.establishment,
      timbre_reference: payload.timbre_reference,
    })

    return sendSuccess(ctx, serializePointDeVente(pos))
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(pointDeVenteUpdateValidator)
    const pos = await PointDeVente.find(payload.id)
    if (!pos) return sendError(ctx, 'Point de vente introuvable', 404)

    if (payload.code && payload.code !== pos.code) {
      const duplicate = await PointDeVente.findBy('code', payload.code)
      if (duplicate && duplicate.id !== pos.id) {
        return sendError(ctx, 'Ce code point de vente est déjà utilisé', 422)
      }
      pos.code = payload.code
    }

    if (payload.nom) pos.nom = payload.nom
    if (payload.adresse !== undefined) pos.adresse = payload.adresse ?? null
    if (payload.ville !== undefined) pos.ville = payload.ville ?? null
    if (payload.telephone !== undefined) pos.telephone = payload.telephone ?? null
    if (payload.point_of_sale !== undefined) pos.pointOfSale = payload.point_of_sale ?? null
    if (payload.establishment !== undefined) pos.establishment = payload.establishment ?? null
    if (payload.timbre_reference !== undefined) pos.timbreReference = payload.timbre_reference ?? null
    if (payload.is_active !== undefined) pos.isActive = payload.is_active

    await pos.save()

    return sendSuccess(ctx, serializePointDeVente(pos))
  }

  async deactivate(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(pointDeVenteIdValidator)
    const pos = await PointDeVente.find(id)
    if (!pos) return sendError(ctx, 'Point de vente introuvable', 404)

    const activeCount = await PointDeVente.query().where('is_active', true).count('* as total')
    if (pos.isActive && Number(activeCount[0].$extras.total) <= 1) {
      return sendError(ctx, 'Impossible de désactiver le dernier point de vente actif', 422)
    }

    pos.isActive = false
    await pos.save()

    return sendSuccess(ctx, {
      message: 'Point de vente désactivé',
      point_de_vente: serializePointDeVente(pos),
    })
  }
}
