import ExcelJS from 'exceljs'
import type { ImportRowError } from '#types/import_result'

export class ExcelImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExcelImportError'
  }
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function cellValue(cell: ExcelJS.Cell): string | number | boolean | undefined {
  const raw = cell.value
  if (raw === null || raw === undefined) return undefined

  if (typeof raw === 'object') {
    if ('result' in raw && raw.result !== undefined && raw.result !== null) {
      return cellValue({ value: raw.result } as ExcelJS.Cell)
    }
    if ('text' in raw && typeof raw.text === 'string') {
      const text = raw.text.trim()
      return text === '' ? undefined : text
    }
    if ('richText' in raw && Array.isArray(raw.richText)) {
      const text = raw.richText.map((part) => part.text).join('').trim()
      return text === '' ? undefined : text
    }
    if (raw instanceof Date) {
      return raw.toISOString()
    }
    return undefined
  }

  if (typeof raw === 'string') {
    const text = raw.trim()
    return text === '' ? undefined : text
  }

  return raw
}

export async function parseExcelRows(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as ExcelJS.Buffer)

  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 2) {
    throw new ExcelImportError('Fichier Excel vide ou sans données (en-têtes + au moins une ligne)')
  }

  const headerRow = sheet.getRow(1)
  const headers: Record<number, string> = {}

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = normalizeHeader(String(cellValue(cell) ?? ''))
    if (header) {
      headers[colNumber] = header
    }
  })

  if (Object.keys(headers).length === 0) {
    throw new ExcelImportError('Aucune colonne reconnue dans la première ligne')
  }

  const rows: Record<string, unknown>[] = []

  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex++) {
    const row = sheet.getRow(rowIndex)
    const record: Record<string, unknown> = {}
    let hasData = false

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber]
      if (!key) return

      const value = cellValue(cell)
      if (value !== undefined) {
        hasData = true
        record[key] = value
      }
    })

    if (hasData) {
      rows.push(record)
    }
  }

  return rows
}

export function pickString(row: Record<string, unknown>, aliases: string[]): string | undefined {
  for (const alias of aliases) {
    const value = row[alias]
    if (value === undefined || value === null) continue
    const text = String(value).trim()
    if (text !== '') return text
  }
  return undefined
}

export function pickNumber(row: Record<string, unknown>, aliases: string[]): number | undefined {
  for (const alias of aliases) {
    const value = row[alias]
    if (value === undefined || value === null || value === '') continue
    const num = Number(value)
    if (!Number.isFinite(num)) return undefined
    return num
  }
  return undefined
}

export function pickBoolean(row: Record<string, unknown>, aliases: string[]): boolean | undefined {
  for (const alias of aliases) {
    const value = row[alias]
    if (value === undefined || value === null || value === '') continue
    if (typeof value === 'boolean') return value
    const text = String(value).trim().toLowerCase()
    if (['1', 'true', 'oui', 'yes', 'o'].includes(text)) return true
    if (['0', 'false', 'non', 'no', 'n'].includes(text)) return false
  }
  return undefined
}

export function hasField(row: Record<string, unknown>, aliases: string[]): boolean {
  return pickString(row, aliases) !== undefined || pickNumber(row, aliases) !== undefined
}

export type ImportRequiredField = {
  field: string
  aliases: string[]
  message: string
}

export function validateRequiredFields(
  row: Record<string, unknown>,
  rowNumber: number,
  fields: ImportRequiredField[]
): ImportRowError[] {
  const errors: ImportRowError[] = []

  for (const { field, aliases, message } of fields) {
    if (!hasField(row, aliases)) {
      errors.push({ row: rowNumber, field, message })
    }
  }

  return errors
}
