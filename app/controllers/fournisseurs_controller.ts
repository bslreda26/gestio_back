import Fournisseur from '#models/fournisseur'
import Achat from '#models/achat'
import { sendError, sendPaginated, sendSuccess } from '#helpers/api_response'
import { buildMeta, parsePagination } from '#helpers/pagination'
import { generateFournisseurCode } from '#services/code_generator_service'
import {
  fournisseurAchatsValidator,
  fournisseurCreateValidator,
  fournisseurIdValidator,
  fournisseurSearchValidator,
  fournisseurUpdateValidator,
} from '#validators/fournisseur_validator'
import type { HttpContext } from '@adonisjs/core/http'
import { maskSolde } from '#helpers/solde_visibility'
import { requirePointDeVente, scopeByPointDeVente } from '#helpers/point_de_vente_context'
import { hasUserPermission } from '#services/permission_service'
import {
  getFournisseurSoldePdv,
  getFournisseurSoldesPdv,
} from '#services/fournisseur_solde_service'

const RECENT_ACHATS_LIMIT = 5

export default class FournisseursController {
  async search(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(fournisseurSearchValidator)
    const { page, limit, offset } = parsePagination(payload)
    const pos = requirePointDeVente(ctx)

    const query = Fournisseur.query()

    if (payload.solde_order) {
      const direction = payload.solde_order === 'desc' ? 'DESC' : 'ASC'
      query
        .orderByRaw(
          `(SELECT COALESCE(fs.solde, 0) FROM fournisseur_soldes fs WHERE fs.fournisseur_id = fournisseurs.id AND fs.point_de_vente_id = ?) ${direction}`,
          [pos.pointDeVenteId]
        )
        .orderBy('nom', 'asc')
    } else {
      query.orderBy('nom', 'asc')
    }

    if (payload.nom) query.whereILike('nom', `%${payload.nom}%`)
    if (payload.code) query.whereILike('code', `%${payload.code}%`)
    if (payload.ville) query.whereILike('ville', `%${payload.ville}%`)
    if (payload.is_active !== undefined) query.where('is_active', payload.is_active)
    if (payload.search) {
      const term = `%${payload.search}%`
      query.where((q) => {
        q.whereILike('nom', term)
          .orWhereILike('code', term)
          .orWhereILike('ville', term)
          .orWhereILike('email', term)
          .orWhereILike('contact_nom', term)
      })
    }

    const total = await query.clone().count('* as total')
    const fournisseurs = await query.offset(offset).limit(limit)

    const soldes = await getFournisseurSoldesPdv(
      pos.pointDeVenteId,
      fournisseurs.map((f) => f.id)
    )

    const canSeeSolde = hasUserPermission(ctx.auth.getUserOrFail(), 'fournisseurs_solde')
    return sendPaginated(
      ctx,
      fournisseurs.map((f) => {
        const serialized = f.serialize() as Record<string, unknown>
        serialized.solde = soldes.get(f.id) ?? 0
        return maskSolde(serialized, canSeeSolde)
      }),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }

  async show(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(fournisseurIdValidator)
    const fournisseur = await Fournisseur.find(id)
    if (!fournisseur) return sendError(ctx, 'Fournisseur introuvable', 404)

    const pos = requirePointDeVente(ctx)
    const recentAchats = await scopeByPointDeVente(
      Achat.query()
        .where('fournisseur_id', id)
        .orderBy('date_achat', 'desc')
        .orderBy('id', 'desc')
        .limit(RECENT_ACHATS_LIMIT),
      pos.pointDeVenteId
    )

    const solde = await getFournisseurSoldePdv(id, pos.pointDeVenteId)
    const canSeeSolde = hasUserPermission(ctx.auth.getUserOrFail(), 'fournisseurs_solde')
    const serialized = fournisseur.serialize() as Record<string, unknown>
    serialized.solde = solde
    return sendSuccess(ctx, {
      fournisseur: maskSolde(serialized, canSeeSolde),
      recentAchats,
    })
  }

  async create(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(fournisseurCreateValidator)
    const code = await generateFournisseurCode()

    const fournisseur = await Fournisseur.create({
      code,
      nom: payload.nom,
      email: payload.email ?? null,
      telephone: payload.telephone ?? null,
      adresse: payload.adresse ?? null,
      ville: payload.ville ?? null,
      pays: payload.pays ?? null,
      contactNom: payload.contact_nom ?? null,
      solde: 0,
      notes: payload.notes ?? null,
      isActive: true,
    })

    const canSeeSolde = hasUserPermission(ctx.auth.getUserOrFail(), 'fournisseurs_solde')
    return sendSuccess(ctx, maskSolde(fournisseur.serialize(), canSeeSolde))
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(fournisseurUpdateValidator)
    const fournisseur = await Fournisseur.find(payload.id)
    if (!fournisseur) return sendError(ctx, 'Fournisseur introuvable', 404)

    fournisseur.merge({
      nom: payload.nom ?? fournisseur.nom,
      email: payload.email !== undefined ? payload.email ?? null : fournisseur.email,
      telephone: payload.telephone !== undefined ? payload.telephone ?? null : fournisseur.telephone,
      adresse: payload.adresse !== undefined ? payload.adresse ?? null : fournisseur.adresse,
      ville: payload.ville !== undefined ? payload.ville ?? null : fournisseur.ville,
      pays: payload.pays !== undefined ? payload.pays ?? null : fournisseur.pays,
      contactNom:
        payload.contact_nom !== undefined ? payload.contact_nom ?? null : fournisseur.contactNom,
      notes: payload.notes !== undefined ? payload.notes ?? null : fournisseur.notes,
      isActive: payload.is_active ?? fournisseur.isActive,
    })
    await fournisseur.save()

    const canSeeSolde = hasUserPermission(ctx.auth.getUserOrFail(), 'fournisseurs_solde')
    return sendSuccess(ctx, maskSolde(fournisseur.serialize(), canSeeSolde))
  }

  async deactivate(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(fournisseurIdValidator)
    const fournisseur = await Fournisseur.find(id)
    if (!fournisseur) return sendError(ctx, 'Fournisseur introuvable', 404)

    fournisseur.isActive = false
    await fournisseur.save()

    return sendSuccess(ctx, { message: 'Fournisseur désactivé', fournisseur })
  }

  async achats(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(fournisseurAchatsValidator)
    const { page, limit, offset } = parsePagination(payload)

    const fournisseur = await Fournisseur.find(payload.id)
    if (!fournisseur) return sendError(ctx, 'Fournisseur introuvable', 404)

    const query = Achat.query().where('fournisseur_id', payload.id).orderBy('date_achat', 'desc')
    if (payload.statut) query.where('statut', payload.statut)
    if (payload.date_from) query.where('date_achat', '>=', payload.date_from.toISODate()!)
    if (payload.date_to) query.where('date_achat', '<=', payload.date_to.toISODate()!)

    const total = await query.clone().count('* as total')
    const achats = await query.offset(offset).limit(limit)

    return sendPaginated(ctx, achats, buildMeta(Number(total[0].$extras.total), page, limit))
  }
}
