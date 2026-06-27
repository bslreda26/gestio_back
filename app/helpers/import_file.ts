import { sendError } from '#helpers/api_response'
import type { HttpContext } from '@adonisjs/core/http'
import { readFile } from 'node:fs/promises'

const ALLOWED_EXTENSIONS = ['xlsx', 'xls'] as const

export async function readImportExcelFile(ctx: HttpContext): Promise<Buffer | null> {
  const file = ctx.request.file('file', {
    size: '10mb',
    extnames: [...ALLOWED_EXTENSIONS],
  })

  if (!file) {
    sendError(ctx, 'Fichier Excel requis (champ multipart « file »)', 422)
    return null
  }

  if (file.hasErrors) {
    const message = file.errors.map((e) => e.message).join(', ') || 'Fichier invalide'
    sendError(ctx, message, 422)
    return null
  }

  const filePath = file.filePath ?? file.tmpPath
  if (!filePath) {
    sendError(ctx, 'Impossible de lire le fichier uploadé', 422)
    return null
  }

  return readFile(filePath)
}

export function parseImportBooleanField(
  value: string | undefined,
  defaultValue = false
): boolean {
  if (value === undefined || value === null || value === '') return defaultValue
  return ['1', 'true', 'oui', 'yes'].includes(value.trim().toLowerCase())
}

export function parseImportNumberField(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}
