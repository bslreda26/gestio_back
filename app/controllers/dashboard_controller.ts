import { sendError, sendSuccess } from '#helpers/api_response'
import { requirePointDeVente } from '#helpers/point_de_vente_context'
import { getDashboard } from '#services/dashboard_service'
import { RapportBusinessError } from '#services/rapport_service'
import { dashboardValidator } from '#validators/dashboard_validator'
import type { HttpContext } from '@adonisjs/core/http'

export default class DashboardController {
  /**
   * Tableau de bord — cartes KPI + progression ventes + top 10 marge produits.
   * Critères: date_debut, date_fin, depot_id?, categorie_id?, client_id?
   */
  async index(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(dashboardValidator)

    try {
      const pos = requirePointDeVente(ctx)
      const data = await getDashboard({
        pointDeVenteId: pos.pointDeVenteId,
        dateDebut: payload.date_debut,
        dateFin: payload.date_fin,
        depotId: payload.depot_id,
        categorieId: payload.categorie_id,
        clientId: payload.client_id,
      })

      return sendSuccess(ctx, data)
    } catch (error) {
      if (error instanceof RapportBusinessError) {
        return sendError(ctx, error.message, 422)
      }
      throw error
    }
  }
}
