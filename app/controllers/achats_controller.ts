import { ACHAT_STATUT, isEditableAchat } from '#constants/achat_statuts'
import Achat from '#models/achat'
import AchatLigne from '#models/achat_ligne'
import Fournisseur from '#models/fournisseur'
import Paiement from '#models/paiement'
import User from '#models/user'
import { sendError, sendPaginated, sendSuccess } from '#helpers/api_response'
import { serializeAchatsForList } from '#helpers/achat_list_serializer'
import { loadProduitCodeMap } from '#helpers/produit_codes'
import {
  assertRecordBelongsToPointDeVente,
  requirePointDeVente,
  scopeByPointDeVente,
} from '#helpers/point_de_vente_context'
import { buildMeta, parsePagination, type PaginationInput } from '#helpers/pagination'
import { CaisseBusinessError } from '#services/caisse_service'
import {
  AchatBusinessError,
  annulerAchat,
  creerAchat,
  creerAchatRetour,
  enregistrerPaiementAchat,
  getLigneAchatInfo,
  modifierAchat,
  recevoirMarchandise,
} from '#services/achat_service'
import {
  achatAnnulerValidator,
  achatCreateValidator,
  achatGetByCriteriaValidator,
  achatIdValidator,
  achatLigneInfoValidator,
  achatPaiementValidator,
  achatRecevoirValidator,
  achatRetourValidator,
  achatSearchValidator,
  achatUpdateValidator,
} from '#validators/achat_validator'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

type AchatCriteriaPayload = {
  type?: 'achat' | 'retour'
  statut?: string
  statut_paiement?: string
  fournisseur_id?: number
  numero?: string
  search?: string
  date_from?: DateTime
  date_to?: DateTime
}

function applyAchatCriteria(query: ReturnType<typeof Achat.query>, payload: AchatCriteriaPayload) {
  if (payload.type === 'retour') {
    query.where('statut', ACHAT_STATUT.RETOUR)
  } else if (payload.type === 'achat') {
    query.whereNot('statut', ACHAT_STATUT.RETOUR)
  }

  if (payload.statut) query.where('statut', payload.statut)
  if (payload.statut_paiement) query.where('statut_paiement', payload.statut_paiement)
  if (payload.fournisseur_id) query.where('fournisseur_id', payload.fournisseur_id)
  if (payload.numero) query.whereILike('numero', `%${payload.numero}%`)
  if (payload.date_from) query.where('date_achat', '>=', payload.date_from.toISODate()!)
  if (payload.date_to) query.where('date_achat', '<=', payload.date_to.toISODate()!)
  if (payload.search) {
    query.whereILike('numero', `%${payload.search}%`)
  }
}

function handleAchatError(ctx: HttpContext, error: unknown) {
  if (error instanceof AchatBusinessError || error instanceof CaisseBusinessError) {
    return sendError(ctx, error.message, 422)
  }
  throw error
}

export default class AchatsController {
  async search(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(achatSearchValidator)
    return this.queryAchats(ctx, payload)
  }

  async getByCriteria(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(achatGetByCriteriaValidator)
    return this.queryAchats(ctx, payload)
  }

  private async queryAchats(ctx: HttpContext, payload: AchatCriteriaPayload & PaginationInput) {
    const { page, limit, offset } = parsePagination(payload)

    const pos = requirePointDeVente(ctx)
    const query = scopeByPointDeVente(
      Achat.query().orderBy('date_achat', 'desc').orderBy('id', 'desc'),
      pos.pointDeVenteId
    )

    applyAchatCriteria(query, payload)

    const total = await query.clone().count('* as total')
    const achats = await query.offset(offset).limit(limit)
    const data = await serializeAchatsForList(achats)

    return sendPaginated(ctx, data, buildMeta(Number(total[0].$extras.total), page, limit))
  }

  async show(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(achatIdValidator)
    const achat = await Achat.find(id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, achat, 'Achat'))) return

    const [lignes, fournisseur, user, paiements] = await Promise.all([
      AchatLigne.query().where('achat_id', id).orderBy('id', 'asc'),
      Fournisseur.find(achat.fournisseurId),
      User.find(achat.userId),
      Paiement.query()
        .where('type', 'achat')
        .where('reference_id', id)
        .orderBy('date_paiement', 'desc'),
    ])

    const codes = await loadProduitCodeMap(lignes.map((l) => l.produitId))
    const lignesWithCode = lignes.map((ligne) => ({
      ...ligne.serialize(),
      code: codes.get(ligne.produitId),
    }))

    return sendSuccess(ctx, {
      achat,
      lignes: lignesWithCode,
      fournisseur,
      user: user ? { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email } : null,
      paiements,
    })
  }

  /** Default line price from last achat or produit.prix_achat_ht when adding a ligne in the UI */
  async ligneInfo(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(achatLigneInfoValidator)
    try {
      const info = await getLigneAchatInfo(
        payload.produit_id,
        payload.quantite ?? 1,
        payload.prix_unitaire_ht,
        payload.frais,
        payload.remise_pct ?? 0
      )
      return sendSuccess(ctx, info)
    } catch (error) {
      return handleAchatError(ctx, error)
    }
  }

  async create(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(achatCreateValidator)
    try {
      const pos = requirePointDeVente(ctx)
      const achat = await creerAchat(
        {
          fournisseur_id: payload.fournisseur_id,
          date_achat: payload.date_achat,
          reference_fournisseur: payload.reference_fournisseur ?? null,
          remise_montant: payload.remise_montant,
          notes: payload.notes ?? null,
          lignes: payload.lignes,
        },
        ctx.auth.getUserOrFail().id,
        pos.pointDeVenteId,
        pos.pointDeVenteCode
      )
      const lignes = await AchatLigne.query().where('achat_id', achat.id)
      return sendSuccess(ctx, { achat, lignes })
    } catch (error) {
      return handleAchatError(ctx, error)
    }
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(achatUpdateValidator)
    const achat = await Achat.find(payload.id)
    if (!achat) return sendError(ctx, 'Achat introuvable', 404)
    if (!(await assertRecordBelongsToPointDeVente(ctx, achat, 'Achat'))) return
    if (!isEditableAchat(achat.statut)) {
      return sendError(ctx, 'Seule une commande peut être modifiée', 422)
    }

    try {
      const updated = await modifierAchat(payload.id, {
        fournisseur_id: payload.fournisseur_id,
        date_achat: payload.date_achat,
        reference_fournisseur: payload.reference_fournisseur,
        remise_montant: payload.remise_montant,
        notes: payload.notes,
        lignes: payload.lignes,
      })
      const lignes = await AchatLigne.query().where('achat_id', updated.id)
      return sendSuccess(ctx, { achat: updated, lignes })
    } catch (error) {
      return handleAchatError(ctx, error)
    }
  }

  async annuler(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(achatAnnulerValidator)
    const achat = await Achat.find(payload.id)
    if (!achat) return sendError(ctx, 'Achat introuvable', 404)
    if (!(await assertRecordBelongsToPointDeVente(ctx, achat, 'Achat'))) return

    try {
      const deleted = await annulerAchat(
        payload.id,
        ctx.auth.getUserOrFail().id,
        payload.notes ?? null
      )
      return sendSuccess(ctx, { message: 'Achat supprimé', id: deleted.id, achat: deleted })
    } catch (error) {
      return handleAchatError(ctx, error)
    }
  }

  async recevoir(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(achatRecevoirValidator)
    const achat = await Achat.find(payload.id)
    if (!achat) return sendError(ctx, 'Achat introuvable', 404)
    if (!(await assertRecordBelongsToPointDeVente(ctx, achat, 'Achat'))) return

    try {
      const received = await recevoirMarchandise(
        payload.id,
        ctx.auth.getUserOrFail().id,
        payload.date_reception,
        payload.depot_id
      )
      const lignes = await AchatLigne.query().where('achat_id', received.id)
      return sendSuccess(ctx, {
        message: 'Marchandises réceptionnées — commande intégralement reçue',
        achat: received,
        lignes,
      })
    } catch (error) {
      return handleAchatError(ctx, error)
    }
  }

  async retour(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(achatRetourValidator)
    const achatOrigine = await Achat.find(payload.achat_id)
    if (!achatOrigine) return sendError(ctx, 'Achat introuvable', 404)
    if (!(await assertRecordBelongsToPointDeVente(ctx, achatOrigine, 'Achat'))) return

    try {
      const pos = requirePointDeVente(ctx)
      const { retour, achat } = await creerAchatRetour(
        payload.achat_id,
        payload.lignes,
        ctx.auth.getUserOrFail().id,
        pos.pointDeVenteId,
        pos.pointDeVenteCode,
        payload.notes ?? null
      )
      const lignes = await AchatLigne.query().where('achat_id', retour.id)
      return sendSuccess(ctx, {
        message: 'Avoir fournisseur créé — articles remis en stock',
        retour,
        achat,
        lignes,
      })
    } catch (error) {
      return handleAchatError(ctx, error)
    }
  }

  async paiement(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(achatPaiementValidator)
    const achat = await Achat.find(payload.achat_id)
    if (!achat) return sendError(ctx, 'Achat introuvable', 404)
    if (!(await assertRecordBelongsToPointDeVente(ctx, achat, 'Achat'))) return

    try {
      const result = await enregistrerPaiementAchat(
        {
          achat_id: payload.achat_id,
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
      return handleAchatError(ctx, error)
    }
  }
}
