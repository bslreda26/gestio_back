import Category from '#models/category'
import Produit from '#models/produit'
import TvaGroupe from '#models/tva_groupe'
import StockMouvement from '#models/stock_mouvement'
import { sendError, sendPaginated, sendSuccess } from '#helpers/api_response'
import {
  assertRecordBelongsToPointDeVente,
  requirePointDeVente,
  scopeByPointDeVente,
} from '#helpers/point_de_vente_context'
import { buildMeta, parsePagination } from '#helpers/pagination'
import { applyStockAlertFilter } from '#helpers/produit_query'
import { serializeProduit } from '#helpers/produit_serializer'
import { hasUserPermission } from '#services/permission_service'
import { generateProduitCode } from '#services/code_generator_service'
import { calcProduitPricing, calcProduitPricingFromVenteTtc } from '#services/pricing_service'
import { ajustementManuel } from '#services/stock_service'
import { AjustementQuantiteError, resolveAjustementQuantite } from '#services/vente_unite_service'
import {
  produitAjustementValidator,
  produitAlertesValidator,
  produitCalculPrixValidator,
  produitCreateValidator,
  produitIdValidator,
  produitSearchValidator,
  produitUpdateValidator,
} from '#validators/produit_validator'
import type { HttpContext } from '@adonisjs/core/http'

async function getTvaGroupeOrFail(tvaGroupeId: number) {
  const tvaGroupe = await TvaGroupe.find(tvaGroupeId)
  if (!tvaGroupe) throw new Error('Groupe TVA introuvable')
  return tvaGroupe
}

function produitSerializeOptions(ctx: HttpContext) {
  const user = ctx.auth.getUserOrFail()
  return { hidePlancher: !hasUserPermission(user, 'produits_plancher') }
}

export default class ProduitsController {
  async search(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(produitSearchValidator)
    const { page, limit, offset } = parsePagination(payload)

    const pos = requirePointDeVente(ctx)
    const query = scopeByPointDeVente(Produit.query().orderBy('nom', 'asc'), pos.pointDeVenteId)

    if (payload.nom) query.whereILike('nom', `%${payload.nom}%`)
    if (payload.code) query.whereILike('code', `%${payload.code}%`)
    if (payload.categorie_id) query.where('categorie_id', payload.categorie_id)
    if (payload.tva_groupe_id) query.where('tva_groupe_id', payload.tva_groupe_id)
    if (payload.is_active !== undefined) query.where('is_active', payload.is_active)
    if (payload.stock_alert) applyStockAlertFilter(query, payload.stock_alert)
    if (payload.search) {
      const term = `%${payload.search}%`
      query.where((q) => {
        q.whereILike('nom', term).orWhereILike('code', term)
      })
    }

    const total = await query.clone().count('* as total')
    const produits = await query.offset(offset).limit(limit)
    const tvaIds = [...new Set(produits.map((p) => p.tvaGroupeId).filter(Boolean))]
    const tvaMap = new Map(
      (await TvaGroupe.query().whereIn('id', tvaIds)).map((t) => [t.id, t.serialize()])
    )

    return sendPaginated(
      ctx,
      produits.map((p) =>
        serializeProduit(
          p,
          { tvaGroupe: tvaMap.get(p.tvaGroupeId) ?? null },
          produitSerializeOptions(ctx)
        )
      ),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }

  async show(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(produitIdValidator)
    const produit = await Produit.find(id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, produit, 'Produit'))) return

    const [categorie, tvaGroupe] = await Promise.all([
      produit.categorieId ? Category.find(produit.categorieId) : null,
      TvaGroupe.find(produit.tvaGroupeId),
    ])

    const mouvements = await StockMouvement.query()
      .where('produit_id', id)
      .orderBy('created_at', 'desc')
      .limit(10)

    return sendSuccess(ctx, {
      produit: serializeProduit(
        produit,
        {
          categorie: categorie?.serialize() ?? null,
          tvaGroupe: tvaGroupe?.serialize() ?? null,
        },
        produitSerializeOptions(ctx)
      ),
      mouvements,
    })
  }

  async create(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(produitCreateValidator)

    let tvaGroupe: TvaGroupe
    try {
      tvaGroupe = await getTvaGroupeOrFail(payload.tva_groupe_id)
    } catch {
      return sendError(ctx, 'Groupe TVA introuvable', 422)
    }

    const pricing = calcProduitPricingFromVenteTtc({
      prixAchatHt: payload.prix_achat_ht ?? 0,
      prixVenteTtc: payload.prix_vente_ttc ?? 0,
      frais: payload.frais ?? 0,
      tauxTva: Number(tvaGroupe.taux),
    })

    const pos = requirePointDeVente(ctx)
    const code = payload.code ?? (await generateProduitCode(pos.pointDeVenteId))

    const produit = await Produit.create({
      code,
      pointDeVenteId: pos.pointDeVenteId,
      nom: payload.nom,
      description: payload.description ?? null,
      categorieId: payload.categorie_id ?? null,
      tvaGroupeId: payload.tva_groupe_id,
      prixAchatHt: payload.prix_achat_ht ?? 0,
      prixAchatTtc: pricing.prixAchatTtc,
      prixVenteHt: pricing.prixVenteHt,
      prixVenteTtc: pricing.prixVenteTtc,
      frais: payload.frais ?? 0,
      plancher: pricing.plancher,
      unite: payload.unite ?? 'pièce',
      uniteGros: payload.unite_gros ?? null,
      contenance: payload.contenance ?? 1,
      venteAuDetail: payload.vente_au_detail ?? false,
      stockActuel: 0,
      stockMinimum: payload.stock_minimum ?? 0,
      stockMaximum: payload.stock_maximum ?? 0,
      isActive: true,
    })

    return sendSuccess(ctx, serializeProduit(produit, {}, produitSerializeOptions(ctx)))
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(produitUpdateValidator)
    const produit = await Produit.find(payload.id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, produit, 'Produit'))) return

    const user = ctx.auth.getUserOrFail()
    const canEditPlancher = hasUserPermission(user, 'produits_plancher')
    if (payload.plancher !== undefined && !canEditPlancher) {
      return sendError(ctx, 'Accès refusé — modification du plancher non autorisée', 403)
    }

    const tvaGroupeId = payload.tva_groupe_id ?? produit!.tvaGroupeId
    let tvaGroupe: TvaGroupe
    try {
      tvaGroupe = await getTvaGroupeOrFail(tvaGroupeId)
    } catch {
      return sendError(ctx, 'Groupe TVA introuvable', 422)
    }

    produit.merge({
      nom: payload.nom ?? produit.nom,
      code: payload.code ?? produit.code,
      description:
        payload.description !== undefined ? payload.description ?? null : produit.description,
      categorieId:
        payload.categorie_id !== undefined ? payload.categorie_id : produit.categorieId,
      tvaGroupeId,
      prixAchatHt: payload.prix_achat_ht ?? produit.prixAchatHt,
      prixVenteHt:
        payload.prix_vente_ttc !== undefined
          ? produit.prixVenteHt
          : (payload.prix_vente_ht ?? produit.prixVenteHt),
      frais: payload.frais ?? produit.frais,
      unite: payload.unite ?? produit.unite,
      uniteGros: payload.unite_gros !== undefined ? payload.unite_gros ?? null : produit.uniteGros,
      contenance: payload.contenance ?? produit.contenance,
      venteAuDetail:
        payload.vente_au_detail !== undefined ? payload.vente_au_detail : produit.venteAuDetail,
      stockMinimum: payload.stock_minimum ?? produit.stockMinimum,
      stockMaximum: payload.stock_maximum ?? produit.stockMaximum,
      isActive: payload.is_active ?? produit.isActive,
    })

    const pricingBase = {
      prixAchatHt: Number(produit.prixAchatHt),
      frais: Number(produit.frais),
      tauxTva: Number(tvaGroupe.taux),
    }

    const pricing =
      payload.prix_vente_ttc !== undefined
        ? calcProduitPricingFromVenteTtc({
            ...pricingBase,
            prixVenteTtc: payload.prix_vente_ttc,
          })
        : calcProduitPricing({
            ...pricingBase,
            prixVenteHt: Number(produit.prixVenteHt),
          })

    produit.prixVenteHt =
      payload.prix_vente_ttc !== undefined ? pricing.prixVenteHt : produit.prixVenteHt
    produit.prixAchatTtc = pricing.prixAchatTtc
    produit.prixVenteTtc = pricing.prixVenteTtc
    produit.plancher =
      canEditPlancher && payload.plancher !== undefined ? payload.plancher : pricing.plancher
    await produit.save()

    return sendSuccess(ctx, serializeProduit(produit, {}, produitSerializeOptions(ctx)))
  }

  async deactivate(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(produitIdValidator)
    const produit = await Produit.find(id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, produit, 'Produit'))) return

    produit!.isActive = false
    await produit.save()

    return sendSuccess(ctx, {
      message: 'Produit désactivé',
      produit: serializeProduit(produit!, {}, produitSerializeOptions(ctx)),
    })
  }

  async alertes(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(produitAlertesValidator)
    const { page, limit, offset } = parsePagination(payload)

    const pos = requirePointDeVente(ctx)
    const query = scopeByPointDeVente(
      Produit.query()
        .where('is_active', true)
        .whereRaw('stock_actuel <= stock_minimum')
        .orderBy('stock_actuel', 'asc'),
      pos.pointDeVenteId
    )

    const total = await query.clone().count('* as total')
    const produits = await query.offset(offset).limit(limit)

    return sendPaginated(
      ctx,
      produits.map((p) => serializeProduit(p)),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }

  async ajustement(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(produitAjustementValidator)
    const produit = await Produit.find(payload.id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, produit, 'Produit'))) return

    try {
      const quantite = resolveAjustementQuantite(produit, {
        quantite: payload.quantite,
        quantite_pieces: payload.quantite_pieces,
        quantite_detail: payload.quantite_detail,
      })
      await ajustementManuel(
        payload.id,
        quantite,
        payload.type,
        payload.notes ?? null,
        ctx.auth.getUserOrFail().id
      )
    } catch (error) {
      if (
        error instanceof AjustementQuantiteError ||
        (error instanceof Error && error.name === 'StockInsuffisantError')
      ) {
        return sendError(ctx, error.message, 422)
      }
      throw error
    }

    await produit.refresh()
    return sendSuccess(ctx, serializeProduit(produit, {}, produitSerializeOptions(ctx)))
  }

  async calculPrix(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(produitCalculPrixValidator)

    let tvaGroupe: TvaGroupe
    try {
      tvaGroupe = await getTvaGroupeOrFail(payload.tva_groupe_id)
    } catch {
      return sendError(ctx, 'Groupe TVA introuvable', 422)
    }

    const pricing = calcProduitPricingFromVenteTtc({
      prixAchatHt: payload.prix_achat_ht ?? 0,
      prixVenteTtc: payload.prix_vente_ttc ?? 0,
      frais: payload.frais ?? 0,
      tauxTva: Number(tvaGroupe.taux),
    })

    const canSeePlancher = hasUserPermission(ctx.auth.getUserOrFail(), 'produits_plancher')
    return sendSuccess(ctx, {
      tva_groupe: tvaGroupe.serialize(),
      prix_achat_ht: payload.prix_achat_ht ?? 0,
      prix_vente_ttc: pricing.prixVenteTtc,
      prix_vente_ht: pricing.prixVenteHt,
      frais: payload.frais ?? 0,
      prix_achat_ttc: pricing.prixAchatTtc,
      ...(canSeePlancher ? { plancher: pricing.plancher } : {}),
    })
  }
}
