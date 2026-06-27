import ExcelJS from 'exceljs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function buildExcelFile(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Import')

  sheet.addRow(headers)
  for (const row of rows) {
    sheet.addRow(row)
  }

  const dir = await mkdtemp(join(tmpdir(), 'gestio-import-'))
  const filePath = join(dir, 'import.xlsx')
  await workbook.xlsx.writeFile(filePath)
  return filePath
}

export async function cleanupExcelFile(filePath: string) {
  const dir = join(filePath, '..')
  await rm(dir, { recursive: true, force: true })
}
