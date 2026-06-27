import {
  ALL_PERMISSION_KEYS,
  PERMISSION_CATALOG,
  ROLE_PERMISSIONS,
  type PermissionDefinition,
  type PermissionKey,
} from '#config/permissions'

export { ROLE_PERMISSIONS }
import type User from '#models/user'
import { USER_ROLES, type UserRole } from '#validators/common_validator'

function getUserRole(user: { role?: string | null }): UserRole | null {
  const role = user.role
  if (role && (USER_ROLES as readonly string[]).includes(role)) {
    return role as UserRole
  }
  return null
}

export function getRoleDefaultPermissions(role: UserRole | null): PermissionKey[] {
  if (!role) return []
  return ALL_PERMISSION_KEYS.filter((key) =>
    (ROLE_PERMISSIONS[key] as readonly string[]).includes(role)
  )
}

export function getGrantedPermissions(user: User): PermissionKey[] | null {
  const raw = user.permissions
  if (!Array.isArray(raw)) return null
  return raw.filter((key): key is PermissionKey =>
    ALL_PERMISSION_KEYS.includes(key as PermissionKey)
  )
}

export function getEffectivePermissions(user: User): PermissionKey[] {
  if (user.role === 'admin') return [...ALL_PERMISSION_KEYS]

  const granted = getGrantedPermissions(user)
  if (granted) return granted

  return getRoleDefaultPermissions(getUserRole(user))
}

export function hasUserPermission(
  user: User | { role?: string | null; permissions?: string[] | null },
  permission: PermissionKey
): boolean {
  if (user.role === 'admin') return true
  return getEffectivePermissions(user as User).includes(permission)
}

/** Voir CMUP, plancher et prix achat catalogue (lecture). */
export function canViewPlancherCmup(
  user: User | { role?: string | null; permissions?: string[] | null }
): boolean {
  return hasUserPermission(user, 'produits_cmup_plancher')
}

/** CMUP, plancher, frais catalogue et prix achat — saisie manuelle. */
export function canEditPlancherCmupManually(
  user: User | { role?: string | null; permissions?: string[] | null }
): boolean {
  return hasUserPermission(user, 'produits_plancher')
}

export function hasRolePermission(role: UserRole | null, permission: PermissionKey): boolean {
  if (!role) return false
  return (ROLE_PERMISSIONS[permission] as readonly string[]).includes(role)
}

/** Non assignables via l'écran utilisateur — réservées au rôle admin. */
const ADMIN_ONLY_PERMISSION_KEYS: PermissionKey[] = ['produits_plancher', 'imports']

export function normalizePermissionInput(permissions: string[]): PermissionKey[] {
  const unique = [...new Set(permissions)]
  return unique.filter((key): key is PermissionKey =>
    ALL_PERMISSION_KEYS.includes(key as PermissionKey) && !ADMIN_ONLY_PERMISSION_KEYS.includes(key)
  )
}

export function getPermissionsCatalog(): {
  groups: { group: string; permissions: PermissionDefinition[] }[]
} {
  const groups = new Map<string, PermissionDefinition[]>()

  for (const item of PERMISSION_CATALOG) {
    const list = groups.get(item.group) ?? []
    list.push(item)
    groups.set(item.group, list)
  }

  return {
    groups: [...groups.entries()].map(([group, permissions]) => ({ group, permissions })),
  }
}
