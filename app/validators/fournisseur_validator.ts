import vine from '@vinejs/vine'
import { soldeOrderSchema } from '#validators/common_validator'

const fournisseurFields = {
  nom: vine.string().trim().minLength(1).maxLength(150),
  email: vine.string().trim().email().maxLength(150).optional(),
  telephone: vine.string().trim().maxLength(20).optional(),
  adresse: vine.string().trim().optional(),
  ville: vine.string().trim().maxLength(100).optional(),
  pays: vine.string().trim().maxLength(100).optional(),
  contact_nom: vine.string().trim().maxLength(150).optional(),
  notes: vine.string().trim().optional(),
}

export const fournisseurSearchValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    nom: vine.string().trim().optional(),
    code: vine.string().trim().optional(),
    ville: vine.string().trim().optional(),
    is_active: vine.boolean().optional(),
    search: vine.string().trim().minLength(1).maxLength(200).optional(),
    solde_order: soldeOrderSchema,
  })
)

export const fournisseurIdValidator = vine.compile(vine.object({ id: vine.number().positive() }))

export const fournisseurCreateValidator = vine.compile(vine.object(fournisseurFields))

export const fournisseurUpdateValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    nom: vine.string().trim().minLength(1).maxLength(150).optional(),
    email: vine.string().trim().email().maxLength(150).optional(),
    telephone: vine.string().trim().maxLength(20).optional(),
    adresse: vine.string().trim().optional(),
    ville: vine.string().trim().maxLength(100).optional(),
    pays: vine.string().trim().maxLength(100).optional(),
    contact_nom: vine.string().trim().maxLength(150).optional(),
    notes: vine.string().trim().optional(),
    is_active: vine.boolean().optional(),
  })
)

export const fournisseurAchatsValidator = vine.compile(
  vine.object({
    id: vine.number().positive(),
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    statut: vine.string().trim().optional(),
    date_from: vine.date({ formats: ['iso8601'] }).optional(),
    date_to: vine.date({ formats: ['iso8601'] }).optional(),
  })
)
