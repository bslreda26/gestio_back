import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { sendError } from '#helpers/api_response'
import { hasUserPermission } from '#services/permission_service'
import type { PermissionKey } from '#config/permissions'

export type { PermissionKey } from '#config/permissions'
export { ROLE_PERMISSIONS, hasRolePermission as hasPermission } from '#services/permission_service'

export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { permission: PermissionKey }) {
    const user = ctx.auth.user
    if (!user) {
      return sendError(ctx, 'Non authentifié', 401)
    }

    if (!hasUserPermission(user, options.permission)) {
      return sendError(ctx, 'Accès refusé — permissions insuffisantes', 403)
    }

    return next()
  }
}
