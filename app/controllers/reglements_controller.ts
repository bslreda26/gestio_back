import Client from '#models/client'
import Fournisseur from '#models/fournisseur'
import Reglement from '#models/reglement'
import User from '#models/user'
import { sendError, sendPaginated, sendSuccess } from '#helpers/api_response'
import { requirePointDeVente, scopeByPointDeVente } from '#helpers/point_de_vente_context'
import { buildMeta, parsePagination } from '#helpers/pagination'
import { denyDocumentDateWrite } from '#helpers/document_date'
import { CaisseBusinessError } from '#services/caisse_service'
import {
  enregistrerReglementClient,
  enregistrerReglementFournisseur,
  ReglementBusinessError,
} from '#services/reglement_service'
import { getLettrageLignesReglement } from '#services/lettrage_service'
import {
  reglementClientCreateValidator,
  reglementClientSearchValidator,
  reglementFournisseurCreateValidator,
  reglementFournisseurSearchValidator,
  reglementIdValidator,
} from '#validators/reglement_validator'
import type { HttpContext } from '@adonisjs/core/http'

function handleReglementError(ctx: HttpContext, error: unknown) {
  if (error instanceof ReglementBusinessError || error instanceof CaisseBusinessError) {
    return sendError(ctx, error.message, 422)
  }
  throw error
}

function serializeReglement(reglement: Reglement) {
  return {
    id: reglement.id,
    type: reglement.type,
    point_de_vente_id: reglement.pointDeVenteId,
    client_id: reglement.clientId,
    fournisseur_id: reglement.fournisseurId,
    montant: reglement.montant,
    solde_avant: reglement.soldeAvant,
    solde_apres: reglement.soldeApres,
    mode_paiement: reglement.modePaiement,
    date_reglement: reglement.dateReglement,
    reference_externe: reglement.referenceExterne,
    user_id: reglement.userId,
    notes: reglement.notes,
    created_at: reglement.createdAt,
  }
}

export default class ReglementsController {
  async clientCreate(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(reglementClientCreateValidator)
    const dateDenied = denyDocumentDateWrite(ctx, payload.date_reglement, 'La date de règlement')
    if (dateDenied) return dateDenied

    const pos = requirePointDeVente(ctx)

    try {
      const { reglement, client, lettrage } = await enregistrerReglementClient(
        {
          client_id: payload.client_id,
          montant: payload.montant,
          mode_paiement: payload.mode_paiement,
          date_reglement: payload.date_reglement,
          reference_externe: payload.reference_externe ?? null,
          notes: payload.notes ?? null,
        },
        ctx.auth.getUserOrFail().id,
        pos.pointDeVenteId
      )

      return sendSuccess(ctx, {
        message: 'Règlement client enregistré',
        reglement: serializeReglement(reglement),
        client: { id: client.id, code: client.code, nom: client.nom, solde: client.solde },
        lettrage,
      })
    } catch (error) {
      return handleReglementError(ctx, error)
    }
  }

  async clientSearch(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(reglementClientSearchValidator)
    const { page, limit, offset } = parsePagination(payload)
    const pos = requirePointDeVente(ctx)

    const query = scopeByPointDeVente(
      Reglement.query().where('type', 'client').orderBy('date_reglement', 'desc').orderBy('id', 'desc'),
      pos.pointDeVenteId
    )

    if (payload.client_id) query.where('client_id', payload.client_id)
    if (payload.date_from) query.where('date_reglement', '>=', payload.date_from.toISODate()!)
    if (payload.date_to) query.where('date_reglement', '<=', payload.date_to.toISODate()!)

    const total = await query.clone().count('* as total')
    const reglements = await query.offset(offset).limit(limit)

    return sendPaginated(
      ctx,
      reglements.map(serializeReglement),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }

  async clientShow(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(reglementIdValidator)
    const pos = requirePointDeVente(ctx)

    const reglement = await Reglement.query()
      .where('id', id)
      .where('type', 'client')
      .where('point_de_vente_id', pos.pointDeVenteId)
      .first()

    if (!reglement) return sendError(ctx, 'Règlement introuvable', 404)

    const [client, user, lettrage] = await Promise.all([
      reglement.clientId ? Client.find(reglement.clientId) : null,
      User.find(reglement.userId),
      getLettrageLignesReglement(reglement.id),
    ])

    return sendSuccess(ctx, {
      reglement: serializeReglement(reglement),
      client,
      user: user ? { id: user.id, nom: user.nom, prenom: user.prenom } : null,
      lettrage,
    })
  }

  async fournisseurCreate(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(reglementFournisseurCreateValidator)
    const dateDenied = denyDocumentDateWrite(ctx, payload.date_reglement, 'La date de règlement')
    if (dateDenied) return dateDenied

    const pos = requirePointDeVente(ctx)

    try {
      const { reglement, fournisseur, lettrage } = await enregistrerReglementFournisseur(
        {
          fournisseur_id: payload.fournisseur_id,
          montant: payload.montant,
          mode_paiement: payload.mode_paiement,
          date_reglement: payload.date_reglement,
          reference_externe: payload.reference_externe ?? null,
          notes: payload.notes ?? null,
        },
        ctx.auth.getUserOrFail().id,
        pos.pointDeVenteId
      )

      return sendSuccess(ctx, {
        message: 'Règlement fournisseur enregistré',
        reglement: serializeReglement(reglement),
        fournisseur: {
          id: fournisseur.id,
          code: fournisseur.code,
          nom: fournisseur.nom,
          solde: fournisseur.solde,
        },
        lettrage,
      })
    } catch (error) {
      return handleReglementError(ctx, error)
    }
  }

  async fournisseurSearch(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(reglementFournisseurSearchValidator)
    const { page, limit, offset } = parsePagination(payload)
    const pos = requirePointDeVente(ctx)

    const query = scopeByPointDeVente(
      Reglement.query()
        .where('type', 'fournisseur')
        .orderBy('date_reglement', 'desc')
        .orderBy('id', 'desc'),
      pos.pointDeVenteId
    )

    if (payload.fournisseur_id) query.where('fournisseur_id', payload.fournisseur_id)
    if (payload.date_from) query.where('date_reglement', '>=', payload.date_from.toISODate()!)
    if (payload.date_to) query.where('date_reglement', '<=', payload.date_to.toISODate()!)

    const total = await query.clone().count('* as total')
    const reglements = await query.offset(offset).limit(limit)

    return sendPaginated(
      ctx,
      reglements.map(serializeReglement),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }

  async fournisseurShow(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(reglementIdValidator)
    const pos = requirePointDeVente(ctx)

    const reglement = await Reglement.query()
      .where('id', id)
      .where('type', 'fournisseur')
      .where('point_de_vente_id', pos.pointDeVenteId)
      .first()

    if (!reglement) return sendError(ctx, 'Règlement introuvable', 404)

    const [fournisseur, user, lettrage] = await Promise.all([
      reglement.fournisseurId ? Fournisseur.find(reglement.fournisseurId) : null,
      User.find(reglement.userId),
      getLettrageLignesReglement(reglement.id),
    ])

    return sendSuccess(ctx, {
      reglement: serializeReglement(reglement),
      fournisseur,
      user: user ? { id: user.id, nom: user.nom, prenom: user.prenom } : null,
      lettrage,
    })
  }
}
