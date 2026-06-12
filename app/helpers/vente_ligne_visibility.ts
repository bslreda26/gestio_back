import type { HttpContext } from '@adonisjs/core/http'
import { hasUserPermission } from '#services/permission_service'

export function getVenteLigneVisibility(ctx: HttpContext) {
  const user = ctx.auth.getUserOrFail()
  return {
    includeMarge: hasUserPermission(user, 'ventes_ligne_marge'),
    includePlancher: hasUserPermission(user, 'ventes_ligne_plancher'),
  }
}
