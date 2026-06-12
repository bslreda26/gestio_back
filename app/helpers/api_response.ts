import type { HttpContext } from '@adonisjs/core/http'

export type PaginationMeta = {
  total: number
  page: number
  limit: number
  lastPage: number
}

export type ApiSuccessEnvelope<T> = {
  data: T
  meta?: PaginationMeta
}

export type ApiErrorEnvelope = {
  message: string
  errors?: Record<string, string[]>
}

export function success<T>(data: T, meta?: PaginationMeta): ApiSuccessEnvelope<T> {
  if (meta) {
    return { data, meta }
  }
  return { data }
}

export function paginated<T>(data: T[], meta: PaginationMeta): ApiSuccessEnvelope<T[]> {
  return { data, meta }
}

export function sendSuccess<T>(ctx: HttpContext, data: T, meta?: PaginationMeta) {
  return ctx.response.ok(success(data, meta))
}

export function sendPaginated<T>(ctx: HttpContext, data: T[], meta: PaginationMeta) {
  return ctx.response.ok(paginated(data, meta))
}

export function sendError(
  ctx: HttpContext,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 501 = 400,
  errors?: Record<string, string[]>
) {
  const body: ApiErrorEnvelope = { message }
  if (errors) {
    body.errors = errors
  }
  return ctx.response.status(status).send(body)
}
