import Client from '#models/client'
import Paiement from '#models/paiement'
import User from '#models/user'
import Vente from '#models/vente'
import VenteLigne from '#models/vente_ligne'
import { sendError, sendPaginated, sendSuccess } from '#helpers/api_response'
import {
  assertRecordBelongsToPointDeVente,
  requirePointDeVente,
  scopeByPointDeVente,
} from '#helpers/point_de_vente_context'
import { serializeVentesForList } from '#helpers/vente_list_serializer'
import { serializeVenteLignesForApi } from '#helpers/vente_ligne_serializer'
import { serializeVenteForApi } from '#helpers/vente_serializer'
import { getVenteLigneVisibility } from '#helpers/vente_ligne_visibility'
import { buildMeta, parsePagination, type PaginationInput } from '#helpers/pagination'
import { CaisseBusinessError } from '#services/caisse_service'
import {
  acquireVenteLock,
  assertVenteLockHeld,
  buildVenteLockInfo,
  clearVenteLock,
  releaseVenteLock,
  renewVenteLock,
  VenteLockError,
} from '#services/vente_lock_service'
import {
  annulerDevis,
  convertirDevisEnFacture,
  mettreAJourVente,
  creerFactureRetour,
  creerVente,
  enregistrerPaiementVente,
  getLigneVenteInfo,
  supprimerFacture,
  validerFacture,
  VenteBusinessError,
} from '#services/vente_service'
import {
  loadVenteImpressionContext,
  recordVenteImpression,
} from '#services/vente_impression_service'
import {
  generateVenteBonSortiePdf,
  generateVenteFacturePdf,
  pdfFilename,
} from '#services/vente_pdf_service'
import {
  venteAnnulerValidator,
  venteCreateValidator,
  venteIdValidator,
  venteLigneInfoValidator,
  ventePaiementValidator,
  ventePaiementsSearchValidator,
  venteGetByCriteriaValidator,
  venteImprimerValidator,
  venteRetourValidator,
  venteSearchValidator,
  venteUnlockValidator,
  venteUpdateValidator,
} from '#validators/vente_validator'
import { VENTE_STATUT, VENTE_STATUT_LABELS } from '#constants/vente_statuts'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

type VenteCriteriaPayload = {
  type?: 'vente' | 'retour'
  statut?: string
  statut_paiement?: string
  client_id?: number
  user_id?: number
  numero?: string
  search?: string
  date_from?: DateTime
  date_to?: DateTime
}

function applyVenteCriteria(query: ReturnType<typeof Vente.query>, payload: VenteCriteriaPayload) {
  if (payload.type === 'retour') {
    query.where('statut', VENTE_STATUT.RETOUR)
  } else if (payload.type === 'vente') {
    query.whereNot('statut', VENTE_STATUT.RETOUR)
  }

  if (payload.statut) query.where('statut', payload.statut)
  if (payload.statut_paiement) query.where('statut_paiement', payload.statut_paiement)
  if (payload.client_id) query.where('client_id', payload.client_id)
  if (payload.user_id) query.where('user_id', payload.user_id)
  if (payload.numero) query.whereILike('numero', `%${payload.numero}%`)
  if (payload.date_from) query.where('date_vente', '>=', payload.date_from.toISODate()!)
  if (payload.date_to) query.where('date_vente', '<=', payload.date_to.toISODate()!)
  if (payload.search) {
    query.whereILike('numero', `%${payload.search}%`)
  }
}

function handleVenteError(ctx: HttpContext, error: unknown) {
  if (error instanceof VenteLockError) {
    throw error
  }
  if (error instanceof VenteBusinessError || error instanceof CaisseBusinessError) {
    return sendError(ctx, error.message, 422)
  }
  throw error
}

export default class VentesController {
  async search(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(venteSearchValidator)
    return this.queryVentes(ctx, payload)
  }

  async getByCriteria(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(venteGetByCriteriaValidator)
    return this.queryVentes(ctx, payload)
  }

  private async queryVentes(ctx: HttpContext, payload: VenteCriteriaPayload & PaginationInput) {
    const { page, limit, offset } = parsePagination(payload)

    const pos = requirePointDeVente(ctx)
    const query = scopeByPointDeVente(
      Vente.query().orderBy('date_vente', 'desc').orderBy('id', 'desc'),
      pos.pointDeVenteId
    )

    applyVenteCriteria(query, payload)

    const total = await query.clone().count('* as total')
    const ventes = await query.offset(offset).limit(limit)
    const data = await serializeVentesForList(ventes)

    return sendPaginated(ctx, data, buildMeta(Number(total[0].$extras.total), page, limit))
  }

  /** Default line price from produit.prix_vente_ttc when adding a ligne in the UI */
  async ligneInfo(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(venteLigneInfoValidator)
    try {
      const info = await getLigneVenteInfo(
        payload.produit_id,
        payload.quantite ?? 1,
        payload.remise_pct ?? 0,
        false,
        payload.mode_vente ?? 'piece'
      )
      const visibility = getVenteLigneVisibility(ctx)
      const { marge: _marge, plancher: _plancher, ...publicInfo } = info
      return sendSuccess(ctx, {
        ...publicInfo,
        ...(visibility.includePlancher ? { plancher: info.plancher } : {}),
        ...(visibility.includeMarge ? { marge: info.marge } : {}),
      })
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }

  async show(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(venteIdValidator)
    const pos = requirePointDeVente(ctx)
    const vente = await Vente.query()
      .where('id', id)
      .where('point_de_vente_id', pos.pointDeVenteId)
      .first()
    if (!vente) return sendError(ctx, 'Vente introuvable', 404)

    const [lignes, client, user, paiements, factureOrigine, retours] = await Promise.all([
      VenteLigne.query().where('vente_id', id).orderBy('id', 'asc'),
      Client.find(vente.clientId),
      User.find(vente.userId),
      Paiement.query()
        .where('type', 'vente')
        .where('reference_id', id)
        .orderBy('date_paiement', 'desc'),
      vente.factureOrigineId ? Vente.find(vente.factureOrigineId) : null,
      Vente.query().where('facture_origine_id', id).orderBy('id', 'desc'),
    ])

    const lock = await buildVenteLockInfo(vente, ctx.auth.getUserOrFail().id)

    const ligneVisibility = getVenteLigneVisibility(ctx)

    return sendSuccess(ctx, {
      vente: serializeVenteForApi(vente, {
        includeMarge: ligneVisibility.includeMarge,
        includeMargePct: ligneVisibility.includeMargePct,
      }),
      lignes: await serializeVenteLignesForApi(lignes, ligneVisibility),
      client,
      user: user ? { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email } : null,
      paiements,
      factureOrigine,
      retours,
      lock,
    })
  }

  /** Call when opening edit screen — blocks a second user on the same document */
  async lock(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(venteIdValidator)
    try {
      const lock = await acquireVenteLock(id, ctx.auth.getUserOrFail().id)
      return sendSuccess(ctx, { message: 'Document verrouillé pour édition', lock })
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }

  /** Heartbeat while edit screen is open (~every 2 min) */
  async lockRenew(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(venteIdValidator)
    try {
      const lock = await renewVenteLock(id, ctx.auth.getUserOrFail().id)
      return sendSuccess(ctx, { lock })
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }

  /** Call when closing edit screen */
  async unlock(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(venteUnlockValidator)
    const currentUser = ctx.auth.getUserOrFail()
    try {
      await releaseVenteLock(payload.id, currentUser.id, {
        force: payload.force,
        isAdmin: currentUser.role === 'admin',
      })
      return sendSuccess(ctx, { message: 'Verrou libéré' })
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }

  async create(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(venteCreateValidator)
    try {
      const vente = await creerVente(
        {
          statut: payload.statut,
          client_id: payload.client_id,
          date_vente: payload.date_vente,
          date_echeance: payload.date_echeance ?? null,
          remise_pct: payload.remise_pct,
          remise_montant: payload.remise_montant,
          notes: payload.notes ?? null,
          lignes: payload.lignes,
        },
        ctx.auth.getUserOrFail().id,
        requirePointDeVente(ctx)
      )
      const lignes = await VenteLigne.query().where('vente_id', vente.id)
      const ligneVisibility = getVenteLigneVisibility(ctx)
      return sendSuccess(ctx, {
        vente: serializeVenteForApi(vente, {
        includeMarge: ligneVisibility.includeMarge,
        includeMargePct: ligneVisibility.includeMargePct,
      }),
        lignes: await serializeVenteLignesForApi(lignes, ligneVisibility),
      })
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(venteUpdateValidator)
    const vente = await Vente.find(payload.id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, vente, 'Vente'))) return

    try {
      await assertVenteLockHeld(payload.id, ctx.auth.getUserOrFail().id)
      const pos = requirePointDeVente(ctx)
      const updated = await mettreAJourVente(
        {
          id: payload.id,
          client_id: payload.client_id,
          date_vente: payload.date_vente,
          date_echeance: payload.date_echeance,
          remise_pct: payload.remise_pct,
          remise_montant: payload.remise_montant,
          notes: payload.notes,
          lignes: payload.lignes,
        },
        ctx.auth.getUserOrFail().id,
        pos.pointDeVenteId
      )

      const lignes = await VenteLigne.query().where('vente_id', updated.id)
      const ligneVisibility = getVenteLigneVisibility(ctx)
      return sendSuccess(ctx, {
        vente: serializeVenteForApi(updated, {
          includeMarge: ligneVisibility.includeMarge,
          includeMargePct: ligneVisibility.includeMargePct,
        }),
        lignes: await serializeVenteLignesForApi(lignes, ligneVisibility),
      })
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }

  async annuler(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(venteAnnulerValidator)
    try {
      await assertVenteLockHeld(payload.id, ctx.auth.getUserOrFail().id)
      const vente = await annulerDevis(payload.id, payload.notes ?? null)
      await clearVenteLock(payload.id)
      return sendSuccess(ctx, { message: 'Devis annulé', ...vente })
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }

  async convertirFacture(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(venteIdValidator)
    try {
      await assertVenteLockHeld(id, ctx.auth.getUserOrFail().id)
      const pos = requirePointDeVente(ctx)
      const vente = await convertirDevisEnFacture(
        id,
        ctx.auth.getUserOrFail().id,
        pos.pointDeVenteCode,
        pos.pointDeVenteId
      )
      await clearVenteLock(id)
      return sendSuccess(ctx, { message: 'Devis converti en facture', vente })
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }

  async valider(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(venteIdValidator)
    try {
      await assertVenteLockHeld(id, ctx.auth.getUserOrFail().id)
      const vente = await validerFacture(id)
      await clearVenteLock(id)
      return sendSuccess(ctx, { message: 'Facture validée', vente })
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }

  async delete(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(venteIdValidator)
    const pos = requirePointDeVente(ctx)
    const vente = await Vente.query()
      .where('id', id)
      .where('point_de_vente_id', pos.pointDeVenteId)
      .first()
    if (!vente) return sendError(ctx, 'Vente introuvable', 404)

    try {
      await assertVenteLockHeld(id, ctx.auth.getUserOrFail().id)
      const result = await supprimerFacture(id, ctx.auth.getUserOrFail().id)
      await clearVenteLock(id)
      return sendSuccess(ctx, {
        message: `Facture ${result.numero} supprimée`,
        numero: result.numero,
      })
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }

  /**
   * Facture retour — admin only.
   * Returns products to stock; no delete on invoices.
   */
  async retour(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(venteRetourValidator)
    try {
      await acquireVenteLock(payload.facture_id, ctx.auth.getUserOrFail().id)
      const { retour, facture } = await creerFactureRetour(
        payload.facture_id,
        payload.lignes,
        ctx.auth.getUserOrFail().id,
        requirePointDeVente(ctx),
        payload.notes ?? null
      )
      const lignes = await VenteLigne.query().where('vente_id', retour.id)
      await clearVenteLock(payload.facture_id)
      return sendSuccess(ctx, {
        message: 'Facture retour créée — articles retournés au stock',
        retour,
        lignes: await serializeVenteLignesForApi(lignes, getVenteLigneVisibility(ctx)),
        facture,
      })
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }

  async paiement(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(ventePaiementValidator)
    try {
      await assertVenteLockHeld(payload.vente_id, ctx.auth.getUserOrFail().id)
      const result = await enregistrerPaiementVente(
        {
          vente_id: payload.vente_id,
          montant: payload.montant,
          mode_paiement: payload.mode_paiement,
          date_paiement: payload.date_paiement,
          reference_paiement: payload.reference_paiement ?? null,
          notes: payload.notes ?? null,
        },
        ctx.auth.getUserOrFail().id
      )
      return sendSuccess(ctx, result)
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }

  async paiementsSearch(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(ventePaiementsSearchValidator)
    const { page, limit, offset } = parsePagination(payload)

    const query = Paiement.query()
      .where('type', 'vente')
      .where('reference_id', payload.vente_id)
      .orderBy('date_paiement', 'desc')

    const total = await query.clone().count('* as total')
    const paiements = await query.offset(offset).limit(limit)

    return sendPaginated(ctx, paiements, buildMeta(Number(total[0].$extras.total), page, limit))
  }

  async document(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(venteIdValidator)
    const pos = requirePointDeVente(ctx)
    const vente = await Vente.query()
      .where('id', id)
      .where('point_de_vente_id', pos.pointDeVenteId)
      .first()
    if (!vente) return sendError(ctx, 'Vente introuvable', 404)

    const [lignes, client] = await Promise.all([
      VenteLigne.query().where('vente_id', id),
      Client.find(vente.clientId),
    ])

    const typeDocument =
      vente.statut === VENTE_STATUT.DEVIS
        ? 'devis'
        : vente.statut === VENTE_STATUT.RETOUR
          ? 'retour'
          : 'facture'

    const ligneVisibility = getVenteLigneVisibility(ctx)

    const totaux: Record<string, unknown> = {
      sous_total: vente.sousTotal,
      remise: vente.remiseMontant,
      total_ht: vente.totalHt,
      tva: vente.tvaMontant,
      total_ttc: vente.totalTtc,
      montant_paye: vente.montantPaye,
      reste_a_payer: vente.resteAPayer,
    }
    if (ligneVisibility.includeMarge) totaux.marge = Number(vente.marge)
    if (ligneVisibility.includeMargePct) totaux.marge_pct = Number(vente.margePct)

    return sendSuccess(ctx, {
      type: typeDocument,
      statut_label: VENTE_STATUT_LABELS[vente.statut as keyof typeof VENTE_STATUT_LABELS] ?? vente.statut,
      numero: vente.numero,
      date: vente.dateVente,
      client,
      vente: serializeVenteForApi(vente, ligneVisibility),
      lignes: await serializeVenteLignesForApi(lignes, ligneVisibility),
      totaux,
      generated_at: DateTime.now().toISO(),
    })
  }

  /** Genere un PDF facture/devis/retour ou bon de sortie (sans prix). */
  async imprimer(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(venteImprimerValidator)
    const pos = requirePointDeVente(ctx)

    try {
      const ligneVisibility = getVenteLigneVisibility(ctx)
      const impression = await recordVenteImpression(payload.id, payload.type)
      const printCtx = await loadVenteImpressionContext(
        payload.id,
        pos.pointDeVenteId,
        payload.type,
        impression,
        ligneVisibility
      )

      const pdf =
        payload.type === 'facture'
          ? await generateVenteFacturePdf(printCtx)
          : await generateVenteBonSortiePdf(printCtx)

      return ctx.response
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `inline; filename="${pdfFilename(printCtx)}"`)
        .header('X-Impression-Numero', String(impression.impression_numero))
        .header('X-Impression-Label', impression.label)
        .header('X-Impression-Duplicata', impression.is_duplicata ? 'true' : 'false')
        .send(pdf)
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }
}
