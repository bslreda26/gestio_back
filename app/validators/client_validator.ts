import vine from '@vinejs/vine'
import { CLIENT_TYPES } from '#constants/client_types'

export type { ClientType } from '#constants/client_types'
export { CLIENT_TYPES }

const clientFields = {
  nom: vine.string().trim().minLength(1).maxLength(150),
  type: vine.enum(CLIENT_TYPES).optional(),
  email: vine.string().trim().email().maxLength(150).optional(),
  telephone: vine.string().trim().maxLength(20).optional(),
  adresse: vine.string().trim().optional(),
  ville: vine.string().trim().maxLength(100).optional(),
  pays: vine.string().trim().maxLength(100).optional(),
  credit_limit: vine.number().min(0).optional(),
  ncc: vine.string().trim().maxLength(50).optional(),
  exonere_tva: vine.boolean().optional(),
  exonere_airsi: vine.boolean().optional(),
  notes: vine.string().trim().optional(),
}

export const clientSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    nom: vine.string().trim().optional(),
    code: vine.string().trim().optional(),
    telephone: vine.string().trim().optional(),
    ville: vine.string().trim().optional(),
    type: vine.enum(CLIENT_TYPES).optional(),
    is_active: vine.boolean().optional(),
    search: vine.string().trim().minLength(1).maxLength(200).optional(),
  })
)

export const clientIdValidator = vine.compile(vine.object({ id: vine.number().positive() }))

export const clientCreateValidator = vine.compile(vine.object(clientFields))

export const clientUpdateValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    nom: vine.string().trim().minLength(1).maxLength(150).optional(),
    type: vine.enum(CLIENT_TYPES).optional(),
    email: vine.string().trim().email().maxLength(150).optional(),
    telephone: vine.string().trim().maxLength(20).optional(),
    adresse: vine.string().trim().optional(),
    ville: vine.string().trim().maxLength(100).optional(),
    pays: vine.string().trim().maxLength(100).optional(),
    credit_limit: vine.number().min(0).optional(),
    ncc: vine.string().trim().maxLength(50).nullable().optional(),
    exonere_tva: vine.boolean().optional(),
    exonere_airsi: vine.boolean().optional(),
    notes: vine.string().trim().optional(),
    is_active: vine.boolean().optional(),
  })
)

export const clientVentesValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    statut: vine.string().trim().optional(),
    date_from: vine.date({ formats: ['iso8601'] }).optional(),
    date_to: vine.date({ formats: ['iso8601'] }).optional(),
  })
)
