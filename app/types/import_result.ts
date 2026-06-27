export type ImportRowError = {
  row: number
  field?: string
  message: string
}

export type ImportSummary = {
  total_rows: number
  created: number
  updated: number
  skipped: number
  errors: ImportRowError[]
}

export function emptyImportSummary(): ImportSummary {
  return { total_rows: 0, created: 0, updated: 0, skipped: 0, errors: [] }
}
