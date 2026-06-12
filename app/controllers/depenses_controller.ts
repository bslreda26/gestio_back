import Caisse from '#models/caisse'
import Depense from '#models/depense'
import User from '#models/user'
import { sendError, sendPaginated, sendSuccess } from '#helpers/api_response'
import {
  assertRecordBelongsToPointDeVente,
  requirePointDeVente,
  scopeByPointDeVente,
} from '#helpers/point_de_vente_context'
import { buildMeta, parsePagination } from '#helpers/pagination'
import {
  CaisseBusinessError,
  creerDepense,
  mettreAJourDepense,
  supprimerDepense,
} from '#services/caisse_service'
import { DepenseCategorieBusinessError } from '#services/depense_categorie_service'
import {
  depenseCreateValidator,
  depenseIdValidator,
  depenseSearchValidator,
  depenseUpdateValidator,
} from '#validators/depense_validator'
import type { HttpContext } from '@adonisjs/core/http'

function handleDepenseError(ctx: HttpContext, error: unknown) {
  if (error instanceof CaisseBusinessError || error instanceof DepenseCategorieBusinessError) {
    return sendError(ctx, error.message, 422)
  }
  throw error
}

export default class DepensesController {
  async search(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(depenseSearchValidator)
    const { page, limit, offset } = parsePagination(payload)

    const pos = requirePointDeVente(ctx)
    const query = scopeByPointDeVente(
      Depense.query().orderBy('date_depense', 'desc').orderBy('id', 'desc'),
      pos.pointDeVenteId
    )

    if (payload.categorie) query.where('categorie', payload.categorie)
    if (payload.caisse_id) query.where('caisse_id', payload.caisse_id)
    if (payload.date_from) query.where('date_depense', '>=', payload.date_from.toISODate()!)
    if (payload.date_to) query.where('date_depense', '<=', payload.date_to.toISODate()!)
    if (payload.search) query.whereILike('libelle', `%${payload.search}%`)

    const total = await query.clone().count('* as total')
    const depenses = await query.offset(offset).limit(limit)

    return sendPaginated(ctx, depenses, buildMeta(Number(total[0].$extras.total), page, limit))
  }

  async show(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(depenseIdValidator)
    const depense = await Depense.find(id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, depense, 'Dépense'))) return

    const [caisse, user] = await Promise.all([
      Caisse.find(depense.caisseId),
      User.find(depense.userId),
    ])

    return sendSuccess(ctx, {
      depense,
      caisse,
      user: user ? { id: user.id, nom: user.nom, prenom: user.prenom } : null,
    })
  }

  async create(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(depenseCreateValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const depense = await creerDepense(
        {
          libelle: payload.libelle,
          categorie: payload.categorie,
          montant: payload.montant,
          dateDepense: payload.date_depense,
          caisseId: payload.caisse_id,
          notes: payload.notes ?? null,
        },
        ctx.auth.getUserOrFail().id,
        pos.pointDeVenteId
      )
      return sendSuccess(ctx, { message: 'Dépense enregistrée — sortie caisse', depense })
    } catch (error) {
      return handleDepenseError(ctx, error)
    }
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(depenseUpdateValidator)
    try {
      const depense = await mettreAJourDepense(
        payload.id,
        {
          libelle: payload.libelle,
          categorie: payload.categorie,
          montant: payload.montant,
          dateDepense: payload.date_depense,
          notes: payload.notes !== undefined ? payload.notes ?? null : undefined,
        },
        ctx.auth.getUserOrFail().id
      )
      return sendSuccess(ctx, { message: 'Dépense mise à jour', depense })
    } catch (error) {
      return handleDepenseError(ctx, error)
    }
  }

  async delete(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(depenseIdValidator)
    try {
      const result = await supprimerDepense(id, ctx.auth.getUserOrFail().id)
      return sendSuccess(ctx, result)
    } catch (error) {
      return handleDepenseError(ctx, error)
    }
  }
}
