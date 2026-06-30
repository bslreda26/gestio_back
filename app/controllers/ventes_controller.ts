import { parseFneApiResponse } from '#helpers/fne_response_parser'
import { venteTotalAPayer } from '#helpers/timbre'
import Client from '#models/client'
import PointDeVente from '#models/point_de_vente'
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
import { getVenteLigneVisibility, denyVenteRemiseWrite, denyLigneRemisePreview } from '#helpers/vente_ligne_visibility'
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
  FneCertificationError,
  certifierVenteParId,
  certifierVenteParNumero,
  evaluateFneTimbreStatus,
} from '#services/fne_certification_service'
import {
  annulerDevis,
  convertirDevisEnFacture,
  mettreAJourVente,
  creerFactureRetour,
  creerVente,
  enregistrerPaiementVente,
  getLigneVenteInfo,
  supprimerFacture,
  syncVentePaiement,
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
  venteCertifyValidator,
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
import { VENTE_STATUT, VENTE_STATUT_LABELS, isDevis, isFactureRetour } from '#constants/vente_statuts'
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
  if (
    error instanceof VenteBusinessError ||
    error instanceof CaisseBusinessError ||
    error instanceof FneCertificationError
  ) {
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
    const ligneVisibility = getVenteLigneVisibility(ctx)
    const data = await serializeVentesForList(ventes, ligneVisibility)

    return sendPaginated(ctx, data, buildMeta(Number(total[0].$extras.total), page, limit))
  }

  /** Default line price from produit.prix_vente_ttc when adding a ligne in the UI */
  async ligneInfo(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(venteLigneInfoValidator)
    const remisePct = payload.remise_pct ?? payload.remisePct ?? 0
    const denied = denyLigneRemisePreview(ctx, remisePct)
    if (denied) return denied

    const pos = requirePointDeVente(ctx)
    try {
      const info = await getLigneVenteInfo(
        payload.produit_id ?? payload.produitId!,
        payload.quantite ?? 1,
        payload.remise_pct ?? payload.remisePct ?? 0,
        false,
        payload.mode_vente ?? payload.modeVente ?? 'piece',
        payload.depot_id ?? payload.depotId,
        pos.pointDeVenteId,
        payload.client_id ?? payload.clientId
      )
      const visibility = getVenteLigneVisibility(ctx)
      const { marge: _marge, plancher: _plancher, remise_pct: _remisePct, ...publicInfo } = info
      return sendSuccess(ctx, {
        ...publicInfo,
        ...(visibility.includePlancher ? { plancher: info.plancher } : {}),
        ...(visibility.includeMarge ? { marge: info.marge } : {}),
        ...(visibility.includeLigneRemisePct ? { remise_pct: info.remise_pct } : {}),
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

    if (!isDevis(vente.statut)) syncVentePaiement(vente)

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
      vente: serializeVenteForApi(vente, ligneVisibility),
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
    const denied = denyVenteRemiseWrite(ctx, payload)
    if (denied) return denied

    const pos = requirePointDeVente(ctx)
    try {
      const vente = await creerVente(
        {
          statut: payload.statut,
          client_id: payload.client_id,
          date_vente: payload.date_vente,
          date_echeance: payload.date_echeance ?? null,
          remise_pct: payload.remise_pct,
          notes: payload.notes ?? null,
          lignes: payload.lignes,
          depot_id: payload.depot_id,
          depotId: payload.depotId,
          mode_paiement_fne: payload.mode_paiement_fne,
          modePaiementFne: payload.modePaiementFne,
        },
        ctx.auth.getUserOrFail().id,
        pos
      )
      const lignes = await VenteLigne.query().where('vente_id', vente.id)
      const ligneVisibility = getVenteLigneVisibility(ctx)
      return sendSuccess(ctx, {
        vente: serializeVenteForApi(vente, ligneVisibility),
        lignes: await serializeVenteLignesForApi(lignes, ligneVisibility),
      })
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(venteUpdateValidator)
    const denied = denyVenteRemiseWrite(ctx, payload)
    if (denied) return denied

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
          notes: payload.notes,
          lignes: payload.lignes,
          depot_id: payload.depot_id,
          depotId: payload.depotId,
          mode_paiement_fne: payload.mode_paiement_fne,
          modePaiementFne: payload.modePaiementFne,
        },
        ctx.auth.getUserOrFail().id,
        pos.pointDeVenteId
      )

      const lignes = await VenteLigne.query().where('vente_id', updated.id)
      const ligneVisibility = getVenteLigneVisibility(ctx)
      return sendSuccess(ctx, {
        vente: serializeVenteForApi(updated, ligneVisibility),
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
    const pos = requirePointDeVente(ctx)
    try {
      await acquireVenteLock(payload.facture_id, ctx.auth.getUserOrFail().id)
      const { retour, facture, lettrage } = await creerFactureRetour(
        payload.facture_id,
        payload.lignes,
        ctx.auth.getUserOrFail().id,
        pos,
        payload.notes ?? null,
        payload.depot_id
      )
      const lignes = await VenteLigne.query().where('vente_id', retour.id)
      await clearVenteLock(payload.facture_id)
      return sendSuccess(ctx, {
        message: 'Facture retour créée — articles retournés au stock',
        retour,
        lignes: await serializeVenteLignesForApi(lignes, getVenteLigneVisibility(ctx)),
        facture,
        lettrage,
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

    if (!isDevis(vente.statut)) syncVentePaiement(vente)

    const [lignes, client] = await Promise.all([
      VenteLigne.query().where('vente_id', id),
      Client.find(vente.clientId),
    ])

    const fneTimbre = !isDevis(vente.statut) ? evaluateFneTimbreStatus({ vente }) : null

    const typeDocument =
      vente.statut === VENTE_STATUT.DEVIS
        ? 'devis'
        : vente.statut === VENTE_STATUT.RETOUR
          ? 'retour'
          : 'facture'

    const ligneVisibility = getVenteLigneVisibility(ctx)

    const totaux: Record<string, unknown> = {
      sous_total: vente.sousTotal,
      total_ht: vente.totalHt,
      tva: vente.tvaMontant,
      total_ttc: vente.totalTtc,
      airsi_pct: Number(vente.airsiPct),
      airsi_montant: Number(vente.airsiMontant),
      total_apres_airsi: Number(vente.totalApresAirsi),
      montant_timbre: Number(vente.montantTimbre ?? 0),
      total_a_payer: venteTotalAPayer(vente),
      montant_paye: vente.montantPaye,
      reste_a_payer: vente.resteAPayer,
    }
    if (ligneVisibility.includeRemiseMontant) totaux.remise = vente.remiseMontant
    if (ligneVisibility.includeRemiseTotalePct) totaux.remise_pct = Number(vente.remisePct)
    if (ligneVisibility.includeMarge) totaux.marge = Number(vente.marge)
    if (ligneVisibility.includeMargePct) totaux.marge_pct = Number(vente.margePct)

    const factureOrigine = vente.factureOrigineId
      ? await Vente.find(vente.factureOrigineId)
      : null

    return sendSuccess(ctx, {
      type: typeDocument,
      statut_label: VENTE_STATUT_LABELS[vente.statut as keyof typeof VENTE_STATUT_LABELS] ?? vente.statut,
      numero: vente.numero,
      date: vente.dateVente,
      client,
      facture_origine: factureOrigine
        ? {
            id: factureOrigine.id,
            numero: factureOrigine.numero,
            fne_invoice_id: factureOrigine.fneInvoiceId,
            normalise: factureOrigine.normalise,
          }
        : null,
      certification: {
        normalise: vente.normalise,
        test_normalise: vente.testNormalise,
        certified_at: vente.certifiedAt,
        fne_invoice_id: vente.fneInvoiceId,
        fne: vente.normalise ? parseFneApiResponse(vente.apiResponse) : null,
        mode_paiement_fne: vente.modePaiementFne ?? 'deferred',
        fne_timbre: fneTimbre,
      },
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
        .header('X-FNE-Certified', printCtx.vente.normalise ? 'true' : 'false')
        .send(pdf)
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }

  async certify(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(venteCertifyValidator)

    if (!payload.id && !payload.numero) {
      return sendError(ctx, 'Indiquez id ou numero de la facture', 422)
    }

    const venteId = payload.id ?? (await Vente.findBy('numero', payload.numero!))?.id
    if (!venteId) {
      return sendError(ctx, 'Facture introuvable', 404)
    }

    const venteRecord = await Vente.find(venteId)
    if (!(await assertRecordBelongsToPointDeVente(ctx, venteRecord, 'Vente'))) return

    const pos = requirePointDeVente(ctx)
    try {
      const vente = payload.id
        ? await certifierVenteParId(payload.id)
        : await certifierVenteParNumero(payload.numero!)

      const lignes = await VenteLigne.query().where('vente_id', vente.id)
      const ligneVisibility = getVenteLigneVisibility(ctx)

      return sendSuccess(ctx, {
        message: isFactureRetour(vente.statut)
          ? 'Avoir certifié avec succès'
          : 'Facture certifiée avec succès',
        vente: serializeVenteForApi(vente, ligneVisibility),
        lignes: await serializeVenteLignesForApi(lignes, ligneVisibility),
        fne: vente.apiResponse ? JSON.parse(vente.apiResponse) : null,
      })
    } catch (error) {
      return handleVenteError(ctx, error)
    }
  }
}
