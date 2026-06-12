import PointDeVente from '#models/point_de_vente'
import User from '#models/user'
import { sendError, sendPaginated, sendSuccess } from '#helpers/api_response'
import { buildMeta, parsePagination } from '#helpers/pagination'
import {
  getEffectivePermissions,
  getGrantedPermissions,
  getPermissionsCatalog,
  getRoleDefaultPermissions,
  normalizePermissionInput,
} from '#services/permission_service'
import type { UserRole } from '#validators/common_validator'
import {
  userCreateValidator,
  userIdValidator,
  userPermissionsUpdateValidator,
  userSearchValidator,
  userUpdateValidator,
} from '#validators/user_validator'
import type { HttpContext } from '@adonisjs/core/http'

function serializeUser(user: User) {
  return {
    id: user.id,
    nom: user.nom,
    prenom: user.prenom,
    full_name: user.fullName,
    email: user.email,
    role: user.role,
    is_active: user.isActive,
    point_de_vente_id: user.pointDeVenteId ?? null,
    permissions: getEffectivePermissions(user),
    permissions_granted: getGrantedPermissions(user),
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  }
}

async function resolvePointDeVenteId(
  role: string,
  pointDeVenteId?: number | null
): Promise<number | null> {
  if (role === 'admin') return null
  if (!pointDeVenteId) return null
  const pos = await PointDeVente.query().where('id', pointDeVenteId).where('is_active', true).first()
  return pos ? pos.id : null
}

async function countActiveAdmins(excludeUserId?: number): Promise<number> {
  const query = User.query().where('role', 'admin').where('is_active', true)
  if (excludeUserId) query.whereNot('id', excludeUserId)
  const result = await query.count('* as total')
  return Number(result[0].$extras.total)
}

export default class UsersController {
  async search(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(userSearchValidator)
    const { page, limit, offset } = parsePagination(payload)

    const query = User.query().orderBy('nom', 'asc').orderBy('prenom', 'asc')

    if (payload.nom) query.whereILike('nom', `%${payload.nom}%`)
    if (payload.email) query.whereILike('email', `%${payload.email}%`)
    if (payload.role) query.where('role', payload.role)
    if (payload.is_active !== undefined) query.where('is_active', payload.is_active)
    if (payload.search) {
      const term = `%${payload.search}%`
      query.where((q) => {
        q.whereILike('nom', term)
          .orWhereILike('prenom', term)
          .orWhereILike('email', term)
          .orWhereILike('full_name', term)
      })
    }

    const total = await query.clone().count('* as total')
    const users = await query.offset(offset).limit(limit)

    return sendPaginated(
      ctx,
      users.map(serializeUser),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }

  async show(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(userIdValidator)
    const user = await User.find(id)
    if (!user) return sendError(ctx, 'Utilisateur introuvable', 404)

    return sendSuccess(ctx, serializeUser(user))
  }

  /** Liste des accès configurables (pour l'écran admin utilisateur) */
  async permissionsCatalog(ctx: HttpContext) {
    return sendSuccess(ctx, getPermissionsCatalog())
  }

  /** Détail des accès d'un utilisateur */
  async permissionsShow(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(userIdValidator)
    const user = await User.find(id)
    if (!user) return sendError(ctx, 'Utilisateur introuvable', 404)

    const role = user.role as UserRole
    return sendSuccess(ctx, {
      user_id: user.id,
      role: user.role,
      effective: getEffectivePermissions(user),
      granted: getGrantedPermissions(user),
      role_defaults: getRoleDefaultPermissions(role),
    })
  }

  /** Met à jour les accès explicites d'un utilisateur */
  async permissionsUpdate(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(userPermissionsUpdateValidator)
    const user = await User.find(payload.id)
    if (!user) return sendError(ctx, 'Utilisateur introuvable', 404)

    if (user.role === 'admin') {
      return sendError(ctx, 'Les administrateurs ont tous les accès', 422)
    }

    user.permissions = normalizePermissionInput(payload.permissions)
    await user.save()

    return sendSuccess(ctx, {
      message: 'Accès utilisateur mis à jour',
      user: serializeUser(user),
    })
  }

  async create(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(userCreateValidator)

    if (payload.role !== 'admin' && !payload.point_de_vente_id) {
      return sendError(ctx, 'Un point de vente est requis pour ce rôle', 422)
    }

    const pointDeVenteId = await resolvePointDeVenteId(payload.role, payload.point_de_vente_id)
    if (payload.role !== 'admin' && !pointDeVenteId) {
      return sendError(ctx, 'Point de vente introuvable ou inactif', 422)
    }

    const user = await User.create({
      nom: payload.nom,
      prenom: payload.prenom,
      fullName: `${payload.prenom} ${payload.nom}`.trim(),
      email: payload.email,
      password: payload.password,
      role: payload.role,
      pointDeVenteId,
      permissions: null,
      isActive: true,
    })

    return sendSuccess(ctx, serializeUser(user))
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(userUpdateValidator)
    const currentUser = ctx.auth.getUserOrFail()
    const user = await User.find(payload.id)
    if (!user) return sendError(ctx, 'Utilisateur introuvable', 404)

    if (payload.id === currentUser.id && payload.is_active === false) {
      return sendError(ctx, 'Vous ne pouvez pas désactiver votre propre compte', 422)
    }

    if (payload.id === currentUser.id && payload.role && payload.role !== 'admin') {
      return sendError(ctx, 'Vous ne pouvez pas modifier votre propre rôle', 422)
    }

    const nextRole = payload.role ?? user.role
    const nextActive = payload.is_active ?? user.isActive

    if (user.role === 'admin' && (nextRole !== 'admin' || nextActive === false)) {
      const admins = await countActiveAdmins(user.id)
      if (admins === 0) {
        return sendError(ctx, 'Impossible de retirer le dernier administrateur actif', 422)
      }
    }

    if (payload.email && payload.email !== user.email) {
      const duplicate = await User.findBy('email', payload.email)
      if (duplicate && duplicate.id !== user.id) {
        return sendError(ctx, 'Cet email est déjà utilisé', 422)
      }
      user.email = payload.email
    }

    if (payload.nom) user.nom = payload.nom
    if (payload.prenom) user.prenom = payload.prenom
    if (payload.nom || payload.prenom) {
      user.fullName = `${user.prenom ?? ''} ${user.nom ?? ''}`.trim()
    }
    if (payload.role) user.role = payload.role
    if (payload.is_active !== undefined) user.isActive = payload.is_active
    if (payload.password) user.password = payload.password

    if (payload.point_de_vente_id !== undefined) {
      const nextRole = payload.role ?? user.role
      if (nextRole === 'admin') {
        user.pointDeVenteId = null
      } else {
        const pointDeVenteId = await resolvePointDeVenteId(nextRole, payload.point_de_vente_id)
        if (!pointDeVenteId) {
          return sendError(ctx, 'Point de vente introuvable ou inactif', 422)
        }
        user.pointDeVenteId = pointDeVenteId
      }
    } else if (payload.role && payload.role !== 'admin' && !user.pointDeVenteId) {
      return sendError(ctx, 'Un point de vente est requis pour ce rôle', 422)
    } else if (payload.role === 'admin') {
      user.pointDeVenteId = null
      user.permissions = null
    }

    await user.save()

    return sendSuccess(ctx, serializeUser(user))
  }

  async deactivate(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(userIdValidator)
    const currentUser = ctx.auth.getUserOrFail()

    if (id === currentUser.id) {
      return sendError(ctx, 'Vous ne pouvez pas désactiver votre propre compte', 422)
    }

    const user = await User.find(id)
    if (!user) return sendError(ctx, 'Utilisateur introuvable', 404)

    if (user.role === 'admin' && user.isActive) {
      const admins = await countActiveAdmins(user.id)
      if (admins === 0) {
        return sendError(ctx, 'Impossible de désactiver le dernier administrateur actif', 422)
      }
    }

    user.isActive = false
    await user.save()

    return sendSuccess(ctx, { message: 'Utilisateur désactivé', user: serializeUser(user) })
  }
}
