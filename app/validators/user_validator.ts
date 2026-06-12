import vine from '@vinejs/vine'
import { ALL_PERMISSION_KEYS } from '#config/permissions'

const USER_ROLES = ['admin', 'gestionnaire', 'caissier', 'lecteur'] as const

export const userSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    nom: vine.string().trim().optional(),
    email: vine.string().trim().optional(),
    role: vine.enum(USER_ROLES).optional(),
    is_active: vine.boolean().optional(),
    search: vine.string().trim().minLength(1).maxLength(200).optional(),
  })
)

export const userIdValidator = vine.compile(vine.object({ id: vine.number().positive() }))

export const userCreateValidator = vine.compile(
  vine.object({
    nom: vine.string().trim().minLength(1).maxLength(100),
    prenom: vine.string().trim().minLength(1).maxLength(100),
    email: vine.string().trim().email().maxLength(254).unique({ table: 'users', column: 'email' }),
    password: vine.string().minLength(8).maxLength(64),
    role: vine.enum(USER_ROLES),
    point_de_vente_id: vine.number().positive().optional(),
  })
)

export const userUpdateValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    nom: vine.string().trim().minLength(1).maxLength(100).optional(),
    prenom: vine.string().trim().minLength(1).maxLength(100).optional(),
    email: vine.string().trim().email().maxLength(254).optional(),
    password: vine.string().minLength(8).maxLength(64).optional(),
    role: vine.enum(USER_ROLES).optional(),
    is_active: vine.boolean().optional(),
    point_de_vente_id: vine.number().positive().nullable().optional(),
  })
)

export const userPermissionsUpdateValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    permissions: vine.array(vine.enum(ALL_PERMISSION_KEYS)).minLength(0),
  })
)
