import { sendError } from '#helpers/api_response'
import { canEditDocumentDate } from '#services/permission_service'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

export function isDocumentDateToday(date: DateTime): boolean {
  return date.startOf('day').equals(DateTime.now().startOf('day'))
}

export function denyDocumentDateWrite(
  ctx: HttpContext,
  date: DateTime | null | undefined,
  label = 'La date'
) {
  if (date === null || date === undefined) return null

  const user = ctx.auth.getUserOrFail()
  if (canEditDocumentDate(user)) return null
  if (!isDocumentDateToday(date)) {
    return sendError(ctx, `${label} doit être celle du jour`, 403)
  }
  return null
}

export function denyDocumentDatesWrite(
  ctx: HttpContext,
  dates: Array<{ date: DateTime | null | undefined; label?: string }>
) {
  for (const { date, label } of dates) {
    const denied = denyDocumentDateWrite(ctx, date, label)
    if (denied) return denied
  }
  return null
}
