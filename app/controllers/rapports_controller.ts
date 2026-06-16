import { sendError, sendSuccess } from '#helpers/api_response'
import { requirePointDeVente } from '#helpers/point_de_vente_context'
import {
  RapportBusinessError,
  rapportBalanceClients,
  rapportBalanceFournisseurs,
  rapportCaisse,
  rapportChiffreAffaire,
  rapportDepenses,
  rapportReleveClient,
  rapportReleveFournisseur,
  rapportReglementClients,
  rapportReglementFournisseurs,
  rapportStockActuel,
  rapportValeurStock,
} from '#services/rapport_service'
import {
  rapportBalanceClientsValidator,
  rapportBalanceFournisseursValidator,
  rapportCaisseValidator,
  rapportChiffreAffaireValidator,
  rapportDepensesValidator,
  rapportReleveClientValidator,
  rapportReleveFournisseurValidator,
  rapportReglementClientsValidator,
  rapportReglementFournisseursValidator,
  rapportStockActuelValidator,
  rapportValeurStockValidator,
} from '#validators/rapport_validator'
import type { HttpContext } from '@adonisjs/core/http'

function handleRapportError(ctx: HttpContext, error: unknown) {
  if (error instanceof RapportBusinessError) {
    return sendError(ctx, error.message, 422)
  }
  throw error
}

export default class RapportsController {
  /**
   * Rapport caisse — critères: date_from, date_to, page, limit
   * Totaux sur toute la période ; lignes paginées (solde initial page 1, solde final dernière page)
   */
  async caisse(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportCaisseValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const data = await rapportCaisse(
        pos.pointDeVenteId,
        payload.date_from,
        payload.date_to,
        payload.caisse_id,
        { page: payload.page, limit: payload.limit }
      )
      return sendSuccess(ctx, data, data.meta)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }

  /**
   * Stock actuel — critères: categorie_id, stock_alert, search, is_active
   */
  async stockActuel(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportStockActuelValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const data = await rapportStockActuel({
        pointDeVenteId: pos.pointDeVenteId,
        page: payload.page,
        limit: payload.limit,
        categorieId: payload.categorie_id,
        stockAlert: payload.stock_alert,
        search: payload.search,
        isActive: payload.is_active,
      })
      return sendSuccess(ctx, data, data.meta)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }

  /**
   * Valeur stock globale — designation, plancher, quantité, valeur globale (plancher × quantité)
   */
  async valeurStock(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportValeurStockValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const data = await rapportValeurStock(pos.pointDeVenteId, payload.categorie_id, {
        page: payload.page,
        limit: payload.limit,
      })
      return sendSuccess(ctx, data, data.meta)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }

  /**
   * Balance clients — référence, désignation, solde ; total solde clients sur tous les comptes filtrés
   */
  async balanceClients(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportBalanceClientsValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const data = await rapportBalanceClients({
        pointDeVenteId: pos.pointDeVenteId,
        page: payload.page,
        limit: payload.limit,
        clientId: payload.client_id,
        search: payload.search,
      })
      return sendSuccess(ctx, data, data.meta)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }

  /**
   * Relevé client — client_id, date_from, date_to ; solde initial, mouvements, solde final
   */
  async releveClient(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportReleveClientValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const data = await rapportReleveClient(
        pos.pointDeVenteId,
        payload.client_id,
        payload.date_from,
        payload.date_to,
        { page: payload.page, limit: payload.limit }
      )
      return sendSuccess(ctx, data, data.meta)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }

  /**
   * Rapport dépenses — date_debut, date_fin ; total par catégorie et total général
   */
  async depenses(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportDepensesValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const data = await rapportDepenses(
        pos.pointDeVenteId,
        payload.date_debut,
        payload.date_fin
      )
      return sendSuccess(ctx, data)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }

  /**
   * Rapport chiffre d'affaires — CA par client (factures − retours) et total global
   */
  async chiffreAffaire(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportChiffreAffaireValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const data = await rapportChiffreAffaire({
        pointDeVenteId: pos.pointDeVenteId,
        dateDebut: payload.date_debut,
        dateFin: payload.date_fin,
        page: payload.page,
        limit: payload.limit,
        clientId: payload.client_id,
        search: payload.search,
      })
      return sendSuccess(ctx, data, data.meta)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }

  /**
   * Balance fournisseurs — référence, désignation, solde PDV ; total soldes fournisseurs
   */
  async balanceFournisseurs(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportBalanceFournisseursValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const data = await rapportBalanceFournisseurs({
        pointDeVenteId: pos.pointDeVenteId,
        page: payload.page,
        limit: payload.limit,
        fournisseurId: payload.fournisseur_id,
        search: payload.search,
      })
      return sendSuccess(ctx, data, data.meta)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }

  /**
   * Relevé fournisseur — fournisseur_id, date_from, date_to ; solde initial, mouvements, solde final
   */
  async releveFournisseur(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportReleveFournisseurValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const data = await rapportReleveFournisseur(
        pos.pointDeVenteId,
        payload.fournisseur_id,
        payload.date_from,
        payload.date_to,
        { page: payload.page, limit: payload.limit }
      )
      return sendSuccess(ctx, data, data.meta)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }

  /**
   * Rapport règlements clients — date_from, date_to ; liste paginée + totaux période
   */
  async reglementClients(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportReglementClientsValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const data = await rapportReglementClients({
        pointDeVenteId: pos.pointDeVenteId,
        dateFrom: payload.date_from,
        dateTo: payload.date_to,
        page: payload.page,
        limit: payload.limit,
        clientId: payload.client_id,
        modePaiement: payload.mode_paiement,
        search: payload.search,
      })
      return sendSuccess(ctx, data, data.meta)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }

  /**
   * Rapport règlements fournisseurs — date_from, date_to ; liste paginée + totaux période
   */
  async reglementFournisseurs(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportReglementFournisseursValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const data = await rapportReglementFournisseurs({
        pointDeVenteId: pos.pointDeVenteId,
        dateFrom: payload.date_from,
        dateTo: payload.date_to,
        page: payload.page,
        limit: payload.limit,
        fournisseurId: payload.fournisseur_id,
        modePaiement: payload.mode_paiement,
        search: payload.search,
      })
      return sendSuccess(ctx, data, data.meta)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }
}
