import Produit from '#models/produit'
import TvaGroupe from '#models/tva_groupe'
import { sendError, sendPaginated, sendSuccess } from '#helpers/api_response'
import { buildMeta, parsePagination } from '#helpers/pagination'
import {
  tvaGroupeCreateValidator,
  tvaGroupeIdValidator,
  tvaGroupeSearchValidator,
  tvaGroupeUpdateValidator,
} from '#validators/tva_groupe_validator'
import type { HttpContext } from '@adonisjs/core/http'

function serializeTvaGroupe(groupe: TvaGroupe) {
  return {
    id: groupe.id,
    code: groupe.code,
    libelle: groupe.libelle,
    taux: Number(groupe.taux),
    is_active: groupe.isActive,
    created_at: groupe.createdAt,
    updated_at: groupe.updatedAt,
  }
}

export default class TvaGroupesController {
  /** Liste active — formulaire produit */
  async index(ctx: HttpContext) {
    const groupes = await TvaGroupe.query().where('is_active', true).orderBy('taux', 'desc')
    return sendSuccess(ctx, groupes.map(serializeTvaGroupe))
  }

  async show(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(tvaGroupeIdValidator)
    const groupe = await TvaGroupe.find(id)
    if (!groupe) return sendError(ctx, 'Groupe TVA introuvable', 404)

    return sendSuccess(ctx, serializeTvaGroupe(groupe))
  }

  async search(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(tvaGroupeSearchValidator)
    const { page, limit, offset } = parsePagination(payload)

    const query = TvaGroupe.query().orderBy('taux', 'desc').orderBy('code', 'asc')

    if (payload.code) query.whereILike('code', `%${payload.code}%`)
    if (payload.libelle) query.whereILike('libelle', `%${payload.libelle}%`)
    if (payload.is_active !== undefined) query.where('is_active', payload.is_active)
    if (payload.search) {
      const term = `%${payload.search}%`
      query.where((q) => {
        q.whereILike('code', term).orWhereILike('libelle', term)
      })
    }

    const total = await query.clone().count('* as total')
    const groupes = await query.offset(offset).limit(limit)

    return sendPaginated(
      ctx,
      groupes.map(serializeTvaGroupe),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }

  async create(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(tvaGroupeCreateValidator)

    const duplicate = await TvaGroupe.findBy('code', payload.code)
    if (duplicate) return sendError(ctx, 'Ce code TVA existe déjà', 422)

    const groupe = await TvaGroupe.create({
      code: payload.code.toUpperCase(),
      libelle: payload.libelle,
      taux: payload.taux,
      isActive: true,
    })

    return sendSuccess(ctx, serializeTvaGroupe(groupe))
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(tvaGroupeUpdateValidator)
    const groupe = await TvaGroupe.find(payload.id)
    if (!groupe) return sendError(ctx, 'Groupe TVA introuvable', 404)

    if (payload.code && payload.code !== groupe.code) {
      const duplicate = await TvaGroupe.findBy('code', payload.code)
      if (duplicate && duplicate.id !== groupe.id) {
        return sendError(ctx, 'Ce code TVA existe déjà', 422)
      }
      groupe.code = payload.code.toUpperCase()
    }

    if (payload.libelle) groupe.libelle = payload.libelle
    if (payload.taux !== undefined) groupe.taux = payload.taux
    if (payload.is_active !== undefined) groupe.isActive = payload.is_active

    await groupe.save()
    return sendSuccess(ctx, serializeTvaGroupe(groupe))
  }

  async deactivate(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(tvaGroupeIdValidator)
    const groupe = await TvaGroupe.find(id)
    if (!groupe) return sendError(ctx, 'Groupe TVA introuvable', 404)

    const linked = await Produit.query().where('tva_groupe_id', id).where('is_active', true).first()
    if (linked) {
      return sendError(
        ctx,
        'Impossible de désactiver — des produits actifs utilisent ce groupe TVA',
        422
      )
    }

    groupe.isActive = false
    await groupe.save()

    return sendSuccess(ctx, { message: 'Groupe TVA désactivé', groupe: serializeTvaGroupe(groupe) })
  }
}
