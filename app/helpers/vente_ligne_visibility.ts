import { sendError } from '#helpers/api_response'
import { hasUserPermission } from '#services/permission_service'
import type { HttpContext } from '@adonisjs/core/http'

export type VenteApiVisibility = {
  includeMarge: boolean
  includeMargePct: boolean
  includePlancher: boolean
  includeLigneRemisePct: boolean
  includeRemiseTotalePct: boolean
  includeRemiseMontant: boolean
}

export function getVenteLigneVisibility(ctx: HttpContext): VenteApiVisibility {
  return getVenteLigneVisibilityForUser(ctx.auth.getUserOrFail())
}

export function getVenteLigneVisibilityForUser(user: {
  role?: string | null
  permissions?: string[] | null
}): VenteApiVisibility {
  return {
    includeMarge: hasUserPermission(user, 'ventes_ligne_marge'),
    includeMargePct: hasUserPermission(user, 'ventes_marge_pct'),
    includePlancher: hasUserPermission(user, 'ventes_ligne_plancher'),
    includeLigneRemisePct: hasUserPermission(user, 'ventes_ligne_remise'),
    includeRemiseTotalePct: hasUserPermission(user, 'ventes_remise_totale'),
    includeRemiseMontant: hasUserPermission(user, 'ventes_remise_montant'),
  }
}

type VenteRemisePayload = {
  remise_pct?: number
  remisePct?: number
  lignes?: Array<{ remise_pct?: number; remisePct?: number }>
}

export function denyVenteRemiseWrite(ctx: HttpContext, payload: VenteRemisePayload) {
  const user = ctx.auth.getUserOrFail()
  const globalRemise = payload.remise_pct ?? payload.remisePct ?? 0

  if (globalRemise > 0 && !hasUserPermission(user, 'ventes_remise_totale')) {
    return sendError(ctx, 'Accès refusé — remise totale facture non autorisée', 403)
  }

  const lignes = payload.lignes ?? []
  if (
    lignes.some((ligne) => (ligne.remise_pct ?? ligne.remisePct ?? 0) > 0) &&
    !hasUserPermission(user, 'ventes_ligne_remise')
  ) {
    return sendError(ctx, 'Accès refusé — remise % ligne non autorisée', 403)
  }

  return null
}

export function denyLigneRemisePreview(ctx: HttpContext, remisePct: number) {
  if (remisePct > 0 && !hasUserPermission(ctx.auth.getUserOrFail(), 'ventes_ligne_remise')) {
    return sendError(ctx, 'Accès refusé — remise % ligne non autorisée', 403)
  }
  return null
}
