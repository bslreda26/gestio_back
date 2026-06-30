import { sendError, sendSuccess } from '#helpers/api_response'
import { ExcelImportError, parseExcelRows } from '#helpers/excel_import'
import { parseImportBooleanField, parseImportNumberField, readImportExcelFile } from '#helpers/import_file'
import { assertRecordBelongsToPointDeVente, requirePointDeVente } from '#helpers/point_de_vente_context'
import Depot from '#models/depot'
import { importArticlesFromRows } from '#services/article_import_service'
import { importClientsFromRows } from '#services/client_import_service'
import { importFournisseursFromRows } from '#services/fournisseur_import_service'
import { importInventaireFromRows } from '#services/inventaire_import_service'
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

  async articles(ctx: HttpContext) {
    const buffer = await readImportExcelFile(ctx)
    if (!buffer) return

    const updateExisting = parseImportBooleanField(ctx.request.input('update_existing'), true)
    const tvaGroupeId = parseImportNumberField(ctx.request.input('tva_groupe_id'))

    try {
      const rows = await parseExcelRows(buffer)
      const pos = requirePointDeVente(ctx)
      const summary = await importArticlesFromRows(rows, {
        pointDeVenteId: pos.pointDeVenteId,
        updateExisting,
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

  async inventaire(ctx: HttpContext) {
    const buffer = await readImportExcelFile(ctx)
    if (!buffer) return

    const depotId = parseImportNumberField(ctx.request.input('depot_id'))
    const notes = ctx.request.input('notes')?.trim() || null

    if (depotId) {
      const depot = await Depot.find(depotId)
      if (!(await assertRecordBelongsToPointDeVente(ctx, depot, 'Dépôt'))) return
      if (!depot!.isActive) {
        return sendError(ctx, 'Le dépôt est inactif', 422)
      }
    }

    try {
      const rows = await parseExcelRows(buffer)
      const pos = requirePointDeVente(ctx)
      const summary = await importInventaireFromRows(rows, {
        pointDeVenteId: pos.pointDeVenteId,
        depotId,
        userId: ctx.auth.getUserOrFail().id,
        notes,
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
