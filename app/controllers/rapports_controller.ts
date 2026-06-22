import { sendError, sendSuccess } from '#helpers/api_response'
import { assertRecordBelongsToPointDeVente, requirePointDeVente } from '#helpers/point_de_vente_context'
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
  rapportMarge,
  rapportMouvementsStock,
  rapportStockActuel,
  rapportValeurStock,
  rapportCertification,
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
  rapportMargeValidator,
  rapportMouvementsStockValidator,
  rapportStockActuelValidator,
  rapportValeurStockValidator,
  rapportCertificationValidator,
} from '#validators/rapport_validator'
import type { HttpContext } from '@adonisjs/core/http'
import Depot from '#models/depot'
import Produit from '#models/produit'

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
        depotId: payload.depot_id,
      })
      return sendSuccess(ctx, data, data.meta)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }

  /**
   * Mouvements de stock — stock initial, entrées, sorties, stock final sur une période
   */
  async mouvementsStock(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportMouvementsStockValidator)
    try {
      const pos = requirePointDeVente(ctx)

      if (payload.depot_id) {
        const depot = await Depot.find(payload.depot_id)
        if (!(await assertRecordBelongsToPointDeVente(ctx, depot, 'Dépôt'))) return
      }

      if (payload.produit_id) {
        const produit = await Produit.find(payload.produit_id)
        if (!(await assertRecordBelongsToPointDeVente(ctx, produit, 'Produit'))) return
      }

      const data = await rapportMouvementsStock({
        pointDeVenteId: pos.pointDeVenteId,
        dateDebut: payload.date_debut,
        dateFin: payload.date_fin,
        categorieId: payload.categorie_id,
        produitId: payload.produit_id,
        depotId: payload.depot_id,
        search: payload.search,
        page: payload.page,
        limit: payload.limit,
      })
      return sendSuccess(ctx, data, data.meta)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }

  /**
   * Rapport marge — plancher, CA, marge montant et % par article sur une période
   */
  async marge(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportMargeValidator)
    try {
      const pos = requirePointDeVente(ctx)

      if (payload.produit_id) {
        const produit = await Produit.find(payload.produit_id)
        if (!(await assertRecordBelongsToPointDeVente(ctx, produit, 'Produit'))) return
      }

      const data = await rapportMarge({
        pointDeVenteId: pos.pointDeVenteId,
        dateDebut: payload.date_debut,
        dateFin: payload.date_fin,
        categorieId: payload.categorie_id,
        produitId: payload.produit_id,
        produitIds: payload.produit_ids,
        search: payload.search,
        page: payload.page,
        limit: payload.limit,
      })
      return sendSuccess(ctx, data, data.meta)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }

  /**
   * Valeur stock globale — designation, plancher, quantité, valeur globale (plancher × quantité)
   * Option `depot_id` : valorisation pour un dépôt ; `par_depot` : détail par dépôt sur chaque ligne
   */
  async valeurStock(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportValeurStockValidator)
    try {
      const pos = requirePointDeVente(ctx)

      if (payload.depot_id) {
        const depot = await Depot.find(payload.depot_id)
        if (!(await assertRecordBelongsToPointDeVente(ctx, depot, 'Dépôt'))) return
      }

      const data = await rapportValeurStock({
        pointDeVenteId: pos.pointDeVenteId,
        categorieId: payload.categorie_id,
        depotId: payload.depot_id,
        parDepot: payload.par_depot,
        search: payload.search,
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

  /**
   * Rapport certification FNE — factures et avoirs certifiés / non certifiés et total TTC sur période
   */
  async certification(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rapportCertificationValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const data = await rapportCertification({
        pointDeVenteId: pos.pointDeVenteId,
        dateDebut: payload.date_debut,
        dateFin: payload.date_fin,
        page: payload.page,
        limit: payload.limit,
        normalise: payload.normalise,
        search: payload.search,
      })
      return sendSuccess(ctx, data, data.meta)
    } catch (error) {
      return handleRapportError(ctx, error)
    }
  }
}
