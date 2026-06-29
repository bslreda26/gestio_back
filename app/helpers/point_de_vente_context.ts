import PointDeVente from '#models/point_de_vente'
import { sendError } from '#helpers/api_response'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

export type PointDeVenteContext = {
  pointDeVenteId: number
  pointDeVenteCode: string
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    pointDeVente?: PointDeVenteContext
  }
}

export function requirePointDeVente(ctx: HttpContext): PointDeVenteContext {
  if (!ctx.pointDeVente) {
    throw new Error('Contexte point de vente manquant')
  }
  return ctx.pointDeVente
}

export function scopeByPointDeVente<Model extends LucidModel>(
  query: ModelQueryBuilderContract<Model>,
  pointDeVenteId: number
): ModelQueryBuilderContract<Model> {
  return query.where('point_de_vente_id', pointDeVenteId)
}

export async function assertRecordBelongsToPointDeVente(
  ctx: HttpContext,
  record: { pointDeVenteId?: number | null } | null,
  label = 'Ressource'
): Promise<boolean> {
  if (!record) {
    sendError(ctx, `${label} introuvable`, 404)
    return false
  }

  const pos = requirePointDeVente(ctx)
  if (record.pointDeVenteId !== pos.pointDeVenteId) {
    sendError(ctx, `${label} introuvable`, 404)
    return false
  }

  return true
}

export async function loadActivePointDeVente(id: number): Promise<PointDeVente | null> {
  return PointDeVente.query().where('id', id).where('is_active', true).first()
}

/** Admin sans en-tête POS peut accéder à la ressource par id */
export async function assertRecordAccessible(
  ctx: HttpContext,
  record: { pointDeVenteId?: number | null } | null,
  label = 'Ressource'
): Promise<boolean> {
  if (!record) {
    sendError(ctx, `${label} introuvable`, 404)
    return false
  }

  if (ctx.auth.user?.role === 'admin' && !ctx.pointDeVente) {
    return true
  }

  return assertRecordBelongsToPointDeVente(ctx, record, label)
}
