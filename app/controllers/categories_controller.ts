import Category from '#models/category'
import Produit from '#models/produit'
import { sendError, sendPaginated, sendSuccess } from '#helpers/api_response'
import {
  assertRecordAccessible,
  loadActivePointDeVente,
  requirePointDeVente,
  scopeByPointDeVente,
} from '#helpers/point_de_vente_context'
import { buildMeta, parsePagination } from '#helpers/pagination'
import {
  categorieCreateValidator,
  categorieIdValidator,
  categorieSearchValidator,
  categorieUpdateValidator,
} from '#validators/categorie_validator'
import PointDeVente from '#models/point_de_vente'
import type { HttpContext } from '@adonisjs/core/http'

function serializeCategorie(categorie: Category) {
  return {
    id: categorie.id,
    nom: categorie.nom,
    description: categorie.description,
    point_de_vente_id: categorie.pointDeVenteId,
    created_at: categorie.createdAt,
    updated_at: categorie.updatedAt,
  }
}

async function resolveCategoriePointDeVenteId(
  ctx: HttpContext,
  payloadPointDeVenteId?: number
): Promise<number | null> {
  if (payloadPointDeVenteId) {
    const pos = await PointDeVente.query()
      .where('id', payloadPointDeVenteId)
      .where('is_active', true)
      .first()
    return pos ? pos.id : null
  }

  try {
    return requirePointDeVente(ctx).pointDeVenteId
  } catch {
    const user = ctx.auth.user
    if (user?.pointDeVenteId) {
      const pos = await loadActivePointDeVente(user.pointDeVenteId)
      return pos?.id ?? null
    }
    return null
  }
}

export default class CategoriesController {
  async search(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(categorieSearchValidator)
    const { page, limit, offset } = parsePagination(payload)

    const isAdmin = ctx.auth.getUserOrFail().role === 'admin'
    const pointDeVenteId = await resolveCategoriePointDeVenteId(ctx, payload.point_de_vente_id)

    if (!pointDeVenteId && !isAdmin) {
      return sendError(ctx, 'Point de vente requis ou introuvable', 422)
    }

    const query = Category.query().orderBy('nom', 'asc')
    if (pointDeVenteId) {
      scopeByPointDeVente(query, pointDeVenteId)
    }
    if (payload.nom) query.whereILike('nom', `%${payload.nom}%`)

    const total = await query.clone().count('* as total')
    const categories = await query.offset(offset).limit(limit)

    return sendPaginated(
      ctx,
      categories.map(serializeCategorie),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }

  async show(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(categorieIdValidator)
    const categorie = await Category.find(id)
    if (!(await assertRecordAccessible(ctx, categorie, 'Catégorie'))) return

    const produitsCount = await Produit.query()
      .where('categorie_id', id)
      .where('point_de_vente_id', categorie!.pointDeVenteId)
      .count('* as total')

    return sendSuccess(ctx, {
      categorie: serializeCategorie(categorie!),
      produitsCount: Number(produitsCount[0].$extras.total),
    })
  }

  async create(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(categorieCreateValidator)

    const pointDeVenteId = await resolveCategoriePointDeVenteId(ctx, payload.point_de_vente_id)
    if (!pointDeVenteId) {
      return sendError(ctx, 'Point de vente requis ou introuvable', 422)
    }

    const categorie = await Category.create({
      nom: payload.nom,
      description: payload.description ?? null,
      pointDeVenteId,
    })

    return sendSuccess(ctx, serializeCategorie(categorie))
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(categorieUpdateValidator)
    const categorie = await Category.find(payload.id)
    if (!(await assertRecordAccessible(ctx, categorie, 'Catégorie'))) return

    categorie.merge({
      nom: payload.nom ?? categorie.nom,
      description:
        payload.description !== undefined ? payload.description ?? null : categorie.description,
    })
    await categorie.save()

    return sendSuccess(ctx, serializeCategorie(categorie))
  }

  async delete(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(categorieIdValidator)
    const categorie = await Category.find(id)
    if (!(await assertRecordAccessible(ctx, categorie, 'Catégorie'))) return

    const linked = await Produit.query()
      .where('categorie_id', id)
      .where('point_de_vente_id', categorie!.pointDeVenteId)
      .first()
    if (linked) {
      return sendError(
        ctx,
        'Impossible de supprimer — des produits sont liés à cette catégorie',
        422
      )
    }

    await categorie.delete()
    return sendSuccess(ctx, { message: 'Catégorie supprimée' })
  }
}
