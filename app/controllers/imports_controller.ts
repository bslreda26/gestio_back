import { sendError, sendSuccess } from '#helpers/api_response'
import { ExcelImportError, parseExcelRows } from '#helpers/excel_import'
import { parseImportBooleanField, parseImportNumberField, readImportExcelFile } from '#helpers/import_file'
import { requirePointDeVente } from '#helpers/point_de_vente_context'
import { importClientsFromRows } from '#services/client_import_service'
import { importFournisseursFromRows } from '#services/fournisseur_import_service'
import { importStockFromRows } from '#services/stock_import_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class ImportsController {
  async clients(ctx: HttpContext) {
    const buffer = await readImportExcelFile(ctx)
    if (!buffer) return

    const updateExisting = parseImportBooleanField(ctx.request.input('update_existing'), true)

    try {
      const rows = await parseExcelRows(buffer)
      const pos = requirePointDeVente(ctx)
      const summary = await importClientsFromRows(rows, pos.pointDeVenteId, { updateExisting })
      return sendSuccess(ctx, summary)
    } catch (error) {
      if (error instanceof ExcelImportError) {
        return sendError(ctx, error.message, 422)
      }
      throw error
    }
  }

  async fournisseurs(ctx: HttpContext) {
    const buffer = await readImportExcelFile(ctx)
    if (!buffer) return

    const updateExisting = parseImportBooleanField(ctx.request.input('update_existing'), true)

    try {
      const rows = await parseExcelRows(buffer)
      const summary = await importFournisseursFromRows(rows, { updateExisting })
      return sendSuccess(ctx, summary)
    } catch (error) {
      if (error instanceof ExcelImportError) {
        return sendError(ctx, error.message, 422)
      }
      throw error
    }
  }

  async stock(ctx: HttpContext) {
    const buffer = await readImportExcelFile(ctx)
    if (!buffer) return

    const updateExisting = parseImportBooleanField(ctx.request.input('update_existing'), true)
    const createMissingProducts = parseImportBooleanField(
      ctx.request.input('create_missing_products'),
      true
    )
    const tvaGroupeId = parseImportNumberField(ctx.request.input('tva_groupe_id'))

    try {
      const rows = await parseExcelRows(buffer)
      const pos = requirePointDeVente(ctx)
      const summary = await importStockFromRows(rows, {
        pointDeVenteId: pos.pointDeVenteId,
        userId: ctx.auth.getUserOrFail().id,
        updateExisting,
        createMissingProducts,
        tvaGroupeId,
      })
      return sendSuccess(ctx, summary)
    } catch (error) {
      if (error instanceof ExcelImportError) {
        return sendError(ctx, error.message, 422)
      }
      throw error
    }
  }
}
