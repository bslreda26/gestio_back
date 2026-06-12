import PointDeVente from '#models/point_de_vente'
import { sendError } from '#helpers/api_response'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

const HEADER_NAME = 'x-point-de-vente-id'

function parsePointDeVenteId(raw: string | undefined): number | null {
  if (!raw) return null
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export default class PointDeVenteMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user
    if (!user) {
      return sendError(ctx, 'Non authentifié', 401)
    }

    const headerId = parsePointDeVenteId(ctx.request.header(HEADER_NAME))
    const bodyId = parsePointDeVenteId(ctx.request.input('point_de_vente_id'))
    const requestedId = headerId ?? bodyId

    if (user.role === 'admin') {
      if (!requestedId) {
        return sendError(
          ctx,
          'Point de vente requis — envoyez l\'en-tête X-Point-De-Vente-Id',
          400
        )
      }

      const pos = await PointDeVente.query()
        .where('id', requestedId)
        .where('is_active', true)
        .first()

      if (!pos) {
        return sendError(ctx, 'Point de vente introuvable ou inactif', 404)
      }

      ctx.pointDeVente = { pointDeVenteId: pos.id, pointDeVenteCode: pos.code }
      return next()
    }

    if (!user.pointDeVenteId) {
      return sendError(ctx, 'Aucun point de vente assigné à cet utilisateur', 403)
    }

    if (requestedId && requestedId !== user.pointDeVenteId) {
      return sendError(ctx, 'Accès refusé à ce point de vente', 403)
    }

    const pos = await PointDeVente.query()
      .where('id', user.pointDeVenteId)
      .where('is_active', true)
      .first()

    if (!pos) {
      return sendError(ctx, 'Point de vente assigné introuvable ou inactif', 403)
    }

    ctx.pointDeVente = { pointDeVenteId: pos.id, pointDeVenteCode: pos.code }
    return next()
  }
}
