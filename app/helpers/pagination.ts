import type { PaginationMeta } from '#helpers/api_response'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export type PaginationInput = {
  page?: number
  limit?: number
}

export type ParsedPagination = {
  page: number
  limit: number
  offset: number
}

export function parsePagination(payload: PaginationInput = {}): ParsedPagination {
  const page = Math.max(1, Number(payload.page) || DEFAULT_PAGE)
  let limit = Number(payload.limit) || DEFAULT_LIMIT
  limit = Math.min(Math.max(1, limit), MAX_LIMIT)
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

export function buildMeta(total: number, page: number, limit: number): PaginationMeta {
  const lastPage = Math.max(1, Math.ceil(total / limit))
  return { total, page, limit, lastPage }
}
