import app from '@adonisjs/core/services/app'
import { errors as authErrors } from '@adonisjs/auth'
import { errors as lucidErrors } from '@adonisjs/lucid'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors as vineErrors } from '@vinejs/vine'
import { errors as limiterErrors } from '@adonisjs/limiter'
import { sendError } from '#helpers/api_response'
import { AchatBusinessError } from '#services/achat_service'
import { CaisseBusinessError } from '#services/caisse_service'
import { PlancherValidationError } from '#services/pricing_service'
import { StockInsuffisantError } from '#services/stock_service'
import { RapportBusinessError } from '#services/rapport_service'
import { VenteLockError } from '#services/vente_lock_service'
import { ReglementBusinessError } from '#services/reglement_service'
import { VenteBusinessError } from '#services/vente_service'

const BUSINESS_ERROR_TYPES = [
  PlancherValidationError,
  StockInsuffisantError,
  VenteBusinessError,
  AchatBusinessError,
  CaisseBusinessError,
  ReglementBusinessError,
  RapportBusinessError,
] as const

function isBusinessError(error: unknown): error is Error {
  return BUSINESS_ERROR_TYPES.some((Type) => error instanceof Type)
}

function vineMessagesToFieldErrors(messages: unknown): Record<string, string[]> | undefined {
  if (!messages) return undefined

  if (Array.isArray(messages)) {
    const out: Record<string, string[]> = {}
    for (const item of messages) {
      const field = (item as { field?: string }).field ?? '_form'
      const message = (item as { message?: string }).message ?? 'Valeur invalide'
      if (!out[field]) out[field] = []
      out[field].push(message)
    }
    return out
  }

  if (typeof messages === 'object') {
    return messages as Record<string, string[]>
  }

  return undefined
}

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  async handle(error: unknown, ctx: HttpContext) {
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      return sendError(
        ctx,
        'Données invalides',
        422,
        vineMessagesToFieldErrors(error.messages)
      )
    }

    if (error instanceof VenteLockError) {
      const body: { message: string; data?: { locked_by: NonNullable<VenteLockError['lockedBy']> } } =
        { message: error.message }
      if (error.lockedBy) {
        body.data = { locked_by: error.lockedBy }
      }
      return ctx.response.status(409).send(body)
    }

    if (isBusinessError(error)) {
      return sendError(ctx, error.message, 422)
    }

    if (error instanceof lucidErrors.E_ROW_NOT_FOUND) {
      return sendError(ctx, 'Ressource introuvable', 404)
    }

    if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
      return sendError(ctx, 'Identifiants invalides', 401)
    }

    if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS) {
      return sendError(ctx, 'Non authentifié', 401)
    }

    if (error instanceof limiterErrors.E_TOO_MANY_REQUESTS) {
      const retryAfter = error.response.availableIn
      return sendError(
        ctx,
        `Trop de requêtes. Réessayez dans ${retryAfter} secondes.`,
        429
      )
    }

    return super.handle(error, ctx)
  }

  async report(error: unknown, ctx: HttpContext) {
    const url = ctx.request.url()
    const method = ctx.request.method()

    if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
      ctx.logger.warn({ url, method }, 'Tentative de connexion échouée')
      return
    }

    if (error instanceof VenteLockError) {
      ctx.logger.info({ url, method, err: error.message }, 'Verrou vente refusé')
      return
    }

    if (isBusinessError(error)) {
      ctx.logger.info({ url, method, err: error.message }, 'Règle métier rejetée')
      return
    }

    return super.report(error, ctx)
  }
}
