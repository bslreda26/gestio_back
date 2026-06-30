import User from '#models/user'
import { sendError, sendSuccess } from '#helpers/api_response'
import { requirePointDeVente } from '#helpers/point_de_vente_context'
import {
  CaisseBusinessError,
  creerEntreeManuelle,
  fermetureCaisse,
  getHistorique,
  getMouvement,
  getSession,
  getSessionCouranteDetail,
  getSolde,
  ouvertureCaisse,
  searchSessions,
} from '#services/caisse_service'
import {
  caisseEntreeManuelleValidator,
  caisseFermetureValidator,
  caisseGetByCriteriaValidator,
  caisseMouvementIdValidator,
  caisseMouvementsSearchValidator,
  caisseOuvertureValidator,
  caisseSessionIdValidator,
  caisseSessionsGetByCriteriaValidator,
  caisseSessionsSearchValidator,
} from '#validators/caisse_validator'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

function handleCaisseError(ctx: HttpContext, error: unknown) {
  if (error instanceof CaisseBusinessError) {
    return sendError(ctx, error.message, 422)
  }
  throw error
}

export default class CaisseController {
  async solde(ctx: HttpContext) {
    const pos = requirePointDeVente(ctx)
    const solde = await getSolde(pos.pointDeVenteId)
    return sendSuccess(ctx, solde)
  }

  async mouvementsSearch(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(caisseMouvementsSearchValidator)
    return this.queryCaisse(ctx, payload, 'mouvements')
  }

  async getByCriteria(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(caisseGetByCriteriaValidator)
    return this.queryCaisse(ctx, payload, payload.cible ?? 'mouvements')
  }

  private async queryCaisse(
    ctx: HttpContext,
    payload: {
      page?: number
      limit?: number
      type?: 'entree' | 'sortie'
      motif?: string
      designation?: string
      caisse_id?: number
      caisse_session_id?: number
      statut?: 'ouverte' | 'fermee'
      date_from?: DateTime
      date_to?: DateTime
    },
    cible: 'mouvements' | 'sessions'
  ) {
    const pos = requirePointDeVente(ctx)

    if (cible === 'sessions') {
      const result = await searchSessions(pos.pointDeVenteId, payload.caisse_id, {
        page: payload.page,
        limit: payload.limit,
        statut: payload.statut,
        dateFrom: payload.date_from,
        dateTo: payload.date_to,
      })
      return sendSuccess(ctx, { sessions: result.data, caisse: result.caisse }, result.meta)
    }

    const result = await getHistorique(pos.pointDeVenteId, payload.caisse_id, {
      page: payload.page,
      limit: payload.limit,
      type: payload.type,
      motif: payload.motif,
      designation: payload.designation,
      caisseSessionId: payload.caisse_session_id,
      dateFrom: payload.date_from,
      dateTo: payload.date_to,
    })

    return sendSuccess(ctx, { mouvements: result.data, caisse: result.caisse }, result.meta)
  }

  async mouvementsShow(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(caisseMouvementIdValidator)
    try {
      const { mouvement, caisse } = await getMouvement(id)
      const user = await User.find(mouvement.userId)
      return sendSuccess(ctx, {
        mouvement,
        caisse,
        user: user ? { id: user.id, nom: user.nom, prenom: user.prenom } : null,
      })
    } catch (error) {
      return handleCaisseError(ctx, error)
    }
  }

  async ouverture(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(caisseOuvertureValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const { caisse, session } = await ouvertureCaisse(
        pos.pointDeVenteId,
        payload.montant,
        ctx.auth.getUserOrFail().id,
        payload.notes ?? null,
        payload.caisse_id
      )
      return sendSuccess(ctx, {
        message: 'Ouverture caisse enregistrée',
        caisse: {
          id: caisse.id,
          nom: caisse.nom,
          soldeActuel: Number(caisse.soldeActuel),
        },
        session: {
          id: session.id,
          montantOuverture: Number(session.montantOuverture),
          dateOuverture: session.dateOuverture.toISO(),
          statut: session.statut,
        },
      })
    } catch (error) {
      return handleCaisseError(ctx, error)
    }
  }

  async entreeManuelle(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(caisseEntreeManuelleValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const { caisse, mouvement } = await creerEntreeManuelle(
        {
          libelle: payload.libelle,
          montant: payload.montant,
          caisseId: payload.caisse_id,
          notes: payload.notes ?? null,
        },
        ctx.auth.getUserOrFail().id,
        pos.pointDeVenteId
      )
      return sendSuccess(ctx, {
        message: 'Entrée caisse enregistrée',
        caisse: {
          id: caisse.id,
          nom: caisse.nom,
          soldeActuel: Number(caisse.soldeActuel),
        },
        mouvement: {
          id: mouvement.id,
          type: mouvement.type,
          motif: mouvement.motif,
          montant: Number(mouvement.montant),
          libelle: mouvement.libelle,
          soldeAvant: Number(mouvement.soldeAvant),
          soldeApres: Number(mouvement.soldeApres),
          dateMouvement: mouvement.dateMouvement.toISO(),
        },
      })
    } catch (error) {
      return handleCaisseError(ctx, error)
    }
  }

  async fermeture(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(caisseFermetureValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const { caisse, session } = await fermetureCaisse(
        pos.pointDeVenteId,
        payload.montant,
        ctx.auth.getUserOrFail().id,
        payload.notes ?? null,
        payload.caisse_id
      )
      return sendSuccess(ctx, {
        message: 'Fermeture caisse enregistrée',
        caisse: {
          id: caisse.id,
          nom: caisse.nom,
          soldeActuel: Number(caisse.soldeActuel),
        },
        session: {
          id: session.id,
          montantOuverture: Number(session.montantOuverture),
          montantFermeture: Number(session.montantFermeture),
          soldeTheorique: Number(session.soldeTheorique),
          ecart: Number(session.ecart),
          dateOuverture: session.dateOuverture.toISO(),
          dateFermeture: session.dateFermeture?.toISO() ?? null,
          statut: session.statut,
        },
      })
    } catch (error) {
      return handleCaisseError(ctx, error)
    }
  }

  async sessionCourante(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(caisseSessionsSearchValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const result = await getSessionCouranteDetail(pos.pointDeVenteId, payload.caisse_id)
      if (!result) {
        return sendSuccess(ctx, { session: null, mouvements: [], totaux: null })
      }

      return sendSuccess(ctx, {
        session: result.session,
        mouvements: result.mouvements,
        totaux: result.totaux,
      })
    } catch (error) {
      return handleCaisseError(ctx, error)
    }
  }

  async sessionsSearch(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(caisseSessionsSearchValidator)
    return this.querySessions(ctx, payload)
  }

  async sessionsGetByCriteria(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(caisseSessionsGetByCriteriaValidator)
    return this.querySessions(ctx, payload)
  }

  private async querySessions(
    ctx: HttpContext,
    payload: {
      page?: number
      limit?: number
      statut?: 'ouverte' | 'fermee'
      caisse_id?: number
      user_ouverture_id?: number
      date_from?: DateTime
      date_to?: DateTime
    }
  ) {
    const pos = requirePointDeVente(ctx)
    const result = await searchSessions(pos.pointDeVenteId, payload.caisse_id, {
      page: payload.page,
      limit: payload.limit,
      statut: payload.statut,
      userOuvertureId: payload.user_ouverture_id,
      dateFrom: payload.date_from,
      dateTo: payload.date_to,
    })

    return sendSuccess(ctx, { sessions: result.data, caisse: result.caisse }, result.meta)
  }

  async sessionsShow(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(caisseSessionIdValidator)
    try {
      const result = await getSession(id)
      const userOuverture = await User.find(result.session.userOuvertureId)
      const userFermeture = result.session.userFermetureId
        ? await User.find(result.session.userFermetureId)
        : null

      return sendSuccess(ctx, {
        session: result.session,
        caisse: result.caisse,
        mouvements: result.mouvements,
        totaux: result.totaux,
        userOuverture: userOuverture
          ? { id: userOuverture.id, nom: userOuverture.nom, prenom: userOuverture.prenom }
          : null,
        userFermeture: userFermeture
          ? { id: userFermeture.id, nom: userFermeture.nom, prenom: userFermeture.prenom }
          : null,
      })
    } catch (error) {
      return handleCaisseError(ctx, error)
    }
  }
}
