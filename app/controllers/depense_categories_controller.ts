import Depense from '#models/depense'
import DepenseCategory from '#models/depense_category'
import { sendError, sendPaginated, sendSuccess } from '#helpers/api_response'
import { listActiveDepenseCategories } from '#services/depense_categorie_service'
import { buildMeta, parsePagination } from '#helpers/pagination'
import {
  depenseCategorieCreateValidator,
  depenseCategorieIdValidator,
  depenseCategorieSearchValidator,
  depenseCategorieUpdateValidator,
} from '#validators/depense_categorie_validator'
import type { HttpContext } from '@adonisjs/core/http'

function serializeDepenseCategorie(categorie: DepenseCategory) {
  return {
    id: categorie.id,
    code: categorie.code,
    libelle: categorie.libelle,
    is_active: categorie.isActive,
    created_at: categorie.createdAt,
    updated_at: categorie.updatedAt,
  }
}

export default class DepenseCategoriesController {
  /** Liste active — formulaire dépense */
  async index(ctx: HttpContext) {
    const categories = await listActiveDepenseCategories()
    return sendSuccess(ctx, categories.map(serializeDepenseCategorie))
  }

  async show(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(depenseCategorieIdValidator)
    const categorie = await DepenseCategory.find(id)
    if (!categorie) return sendError(ctx, 'Catégorie de dépense introuvable', 404)

    return sendSuccess(ctx, serializeDepenseCategorie(categorie))
  }

  async search(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(depenseCategorieSearchValidator)
    const { page, limit, offset } = parsePagination(payload)

    const query = DepenseCategory.query().orderBy('libelle', 'asc')

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
    const categories = await query.offset(offset).limit(limit)

    return sendPaginated(
      ctx,
      categories.map(serializeDepenseCategorie),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }

  async create(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(depenseCategorieCreateValidator)
    const code = payload.code.toLowerCase().replace(/\s+/g, '_')

    const duplicate = await DepenseCategory.findBy('code', code)
    if (duplicate) return sendError(ctx, 'Ce code de catégorie existe déjà', 422)

    const categorie = await DepenseCategory.create({
      code,
      libelle: payload.libelle,
      isActive: true,
    })

    return sendSuccess(ctx, serializeDepenseCategorie(categorie))
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(depenseCategorieUpdateValidator)
    const categorie = await DepenseCategory.find(payload.id)
    if (!categorie) return sendError(ctx, 'Catégorie de dépense introuvable', 404)

    if (payload.code && payload.code !== categorie.code) {
      const code = payload.code.toLowerCase().replace(/\s+/g, '_')
      const duplicate = await DepenseCategory.findBy('code', code)
      if (duplicate && duplicate.id !== categorie.id) {
        return sendError(ctx, 'Ce code de catégorie existe déjà', 422)
      }

      const used = await Depense.query().where('categorie', categorie.code).first()
      if (used) {
        return sendError(
          ctx,
          'Impossible de modifier le code — des dépenses utilisent cette catégorie',
          422
        )
      }

      categorie.code = code
    }

    if (payload.libelle) categorie.libelle = payload.libelle
    if (payload.is_active !== undefined) categorie.isActive = payload.is_active

    await categorie.save()
    return sendSuccess(ctx, serializeDepenseCategorie(categorie))
  }

  async delete(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(depenseCategorieIdValidator)
    const categorie = await DepenseCategory.find(id)
    if (!categorie) return sendError(ctx, 'Catégorie de dépense introuvable', 404)

    const used = await Depense.query().where('categorie', categorie.code).first()
    if (used) {
      return sendError(
        ctx,
        'Impossible de supprimer — des dépenses utilisent cette catégorie',
        422
      )
    }

    await categorie.delete()
    return sendSuccess(ctx, { message: 'Catégorie de dépense supprimée' })
  }
}
