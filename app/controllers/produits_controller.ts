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
import { applyLowStockAlertFilter, applyStockAlertFilter } from '#helpers/produit_query'
import { serializeProduit } from '#helpers/produit_serializer'
import { canEditPlancherCmupManually, canViewPlancherCmup } from '#services/permission_service'
import { generateProduitCode } from '#services/code_generator_service'
import { calcProduitPricing, calcProduitPricingFromVenteTtc, calcCmupHt } from '#services/pricing_service'
import { ajustementManuel } from '#services/stock_service'
import { convertDepotStocksWhenEnablingDetailConfig, getStocksParDepotForProduit, getStocksParDepotForProduits } from '#services/depot_service'
import {
  AjustementQuantiteError,
  convertPricingWhenEnablingDetailConfig,
  fromProduitPrixStockage,
  resolveProduitUniteInput,
  resolveAjustementQuantite,
  toPlancherStockage,
  toProduitPrixStockage,
} from '#services/vente_unite_service'
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
  return { hidePlancher: !canViewPlancherCmup(user) }
}

function resolveMoyenneAchatHt(payload: {
  prix_achat_ht?: number
  moyenne_achat_ht?: number
}): number | undefined {
  return payload.moyenne_achat_ht ?? payload.prix_achat_ht
}

function assertManualPricingAllowed(
  ctx: HttpContext,
  payload: {
    plancher?: number
    prix_achat_ht?: number
    moyenne_achat_ht?: number
    dernier_prix_achat_ht?: number
    frais?: number
  }
) {
  const canEdit = canEditPlancherCmupManually(ctx.auth.getUserOrFail())
  if (canEdit) return null

  if (payload.plancher !== undefined) {
    return sendError(ctx, 'Accès refusé — modification du plancher non autorisée', 403)
  }
  if (resolveMoyenneAchatHt(payload) !== undefined) {
    return sendError(
      ctx,
      'Accès refusé — modification de la moyenne achat HT non autorisée',
      403
    )
  }
  if (payload.dernier_prix_achat_ht !== undefined) {
    return sendError(
      ctx,
      'Accès refusé — modification du dernier prix achat non autorisée',
      403
    )
  }
  if (payload.frais !== undefined) {
    return sendError(ctx, 'Accès refusé — modification des frais catalogue non autorisée', 403)
  }
  return null
}

function produitUniteShape(unites: ReturnType<typeof resolveProduitUniteInput>) {
  return {
    unite: unites.unite,
    uniteGros: unites.uniteGros,
    contenance: unites.contenance,
  }
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
    const stocksMap = await getStocksParDepotForProduits(produits.map((p) => p.id))
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
          {
            ...produitSerializeOptions(ctx),
            stocksParDepot: stocksMap.get(p.id) ?? [],
          }
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

    const stocksParDepot = await getStocksParDepotForProduit(produit!)

    return sendSuccess(ctx, {
      produit: serializeProduit(
        produit,
        {
          categorie: categorie?.serialize() ?? null,
          tvaGroupe: tvaGroupe?.serialize() ?? null,
        },
        { ...produitSerializeOptions(ctx), stocksParDepot }
      ),
      mouvements,
    })
  }

  async create(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(produitCreateValidator)
    const pricingDenied = assertManualPricingAllowed(ctx, payload)
    if (pricingDenied) return pricingDenied

    let tvaGroupe: TvaGroupe
    try {
      tvaGroupe = await getTvaGroupeOrFail(payload.tva_groupe_id)
    } catch {
      return sendError(ctx, 'Groupe TVA introuvable', 422)
    }

    const unites = resolveProduitUniteInput(payload)
    const uniteProduit = produitUniteShape(unites)
    const moyenneAchatGros = resolveMoyenneAchatHt(payload) ?? 0
    const fraisGros = payload.frais ?? 0
    const prixStockage = toProduitPrixStockage(moyenneAchatGros, fraisGros, uniteProduit)
    const pricing = calcProduitPricingFromVenteTtc({
      prixAchatHt: prixStockage.prixAchatHt,
      prixVenteTtc: payload.prix_vente_ttc ?? 0,
      frais: prixStockage.frais,
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
      prixAchatHt: prixStockage.prixAchatHt,
      prixAchatTtc: pricing.prixAchatTtc,
      dernierPrixAchatHt: payload.dernier_prix_achat_ht ?? moyenneAchatGros,
      prixVenteHt: pricing.prixVenteHt,
      prixVenteTtc: pricing.prixVenteTtc,
      frais: prixStockage.frais,
      plancher: pricing.plancher,
      unite: unites.unite,
      uniteGros: unites.uniteGros,
      contenance: unites.contenance,
      venteAuDetail: unites.venteAuDetail,
      venteSousPlancher: payload.vente_sous_plancher ?? false,
      stockActuel: 0,
      stockMinimum: payload.stock_minimum ?? 0,
      stockMaximum: payload.stock_maximum ?? 0,
      isActive: true,
      airsiPct: payload.airsi_pct ?? 0,
    })

    return sendSuccess(ctx, serializeProduit(produit, {}, {
      ...produitSerializeOptions(ctx),
      tauxTva: Number(tvaGroupe.taux),
    }))
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(produitUpdateValidator)
    const produit = await Produit.find(payload.id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, produit, 'Produit'))) return

    const pricingDenied = assertManualPricingAllowed(ctx, payload)
    if (pricingDenied) return pricingDenied

    const canEditPricing = canEditPlancherCmupManually(ctx.auth.getUserOrFail())
    const moyenneAchatPayload = resolveMoyenneAchatHt(payload)

    const tvaGroupeId = payload.tva_groupe_id ?? produit!.tvaGroupeId
    let tvaGroupe: TvaGroupe
    try {
      tvaGroupe = await getTvaGroupeOrFail(tvaGroupeId)
    } catch {
      return sendError(ctx, 'Groupe TVA introuvable', 422)
    }

    const unitesBefore = {
      unite: produit.unite,
      uniteGros: produit.uniteGros,
      contenance: produit.contenance,
    }
    const unites = resolveProduitUniteInput(payload, produit)
    const uniteProduit = produitUniteShape(unites)

    let prixAchatHt = Number(produit.prixAchatHt)
    let frais = Number(produit.frais)
    let plancher = Number(produit.plancher)

    const pricingConverted = convertPricingWhenEnablingDetailConfig(
      prixAchatHt,
      frais,
      plancher,
      unitesBefore,
      uniteProduit
    )
    prixAchatHt = pricingConverted.prixAchatHt
    frais = pricingConverted.frais
    plancher = pricingConverted.plancher

    if (moyenneAchatPayload !== undefined) {
      const catalogue = fromProduitPrixStockage({
        ...produit,
        prixAchatHt: String(prixAchatHt),
        frais: String(frais),
        plancher: String(plancher),
        contenance: String(unites.contenance),
        unite: unites.unite,
        uniteGros: unites.uniteGros,
      })
      const fraisGros =
        catalogue.mode === 'detail' ? catalogue.fraisGros : catalogue.frais
      const stockage = toProduitPrixStockage(
        moyenneAchatPayload,
        payload.frais !== undefined ? payload.frais : fraisGros,
        uniteProduit
      )
      prixAchatHt = stockage.prixAchatHt
      if (payload.frais !== undefined) {
        frais = stockage.frais
      }
    } else if (payload.frais !== undefined) {
      frais = toProduitPrixStockage(0, payload.frais, uniteProduit).frais
    }

    produit.merge({
      nom: payload.nom ?? produit.nom,
      code: payload.code ?? produit.code,
      description:
        payload.description !== undefined ? payload.description ?? null : produit.description,
      categorieId:
        payload.categorie_id !== undefined ? payload.categorie_id : produit.categorieId,
      tvaGroupeId,
      prixAchatHt,
      dernierPrixAchatHt:
        payload.dernier_prix_achat_ht !== undefined
          ? payload.dernier_prix_achat_ht
          : produit.dernierPrixAchatHt,
      prixVenteHt:
        payload.prix_vente_ttc !== undefined
          ? produit.prixVenteHt
          : (payload.prix_vente_ht ?? produit.prixVenteHt),
      frais,
      stockMinimum: payload.stock_minimum ?? produit.stockMinimum,
      stockMaximum: payload.stock_maximum ?? produit.stockMaximum,
      isActive: payload.is_active ?? produit.isActive,
      airsiPct: payload.airsi_pct ?? produit.airsiPct,
      venteSousPlancher:
        payload.vente_sous_plancher !== undefined
          ? payload.vente_sous_plancher
          : produit.venteSousPlancher,
    })

    produit.unite = unites.unite
    produit.uniteGros = unites.uniteGros
    produit.contenance = String(unites.contenance)
    produit.venteAuDetail = unites.venteAuDetail
    await convertDepotStocksWhenEnablingDetailConfig(
      produit.id,
      unitesBefore,
      uniteProduit
    )

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
      canEditPricing && payload.plancher !== undefined
        ? toPlancherStockage(payload.plancher, uniteProduit)
        : pricing.plancher
    await produit.save()

    return sendSuccess(ctx, serializeProduit(produit, {}, {
      ...produitSerializeOptions(ctx),
      tauxTva: Number(tvaGroupe.taux),
    }))
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
        .orderBy('stock_actuel', 'asc'),
      pos.pointDeVenteId
    )
    applyLowStockAlertFilter(query, payload.depot_id)

    const total = await query.clone().count('* as total')
    const produits = await query.offset(offset).limit(limit)
    const stocksMap = await getStocksParDepotForProduits(produits.map((p) => p.id))
    const tvaIds = [...new Set(produits.map((p) => p.tvaGroupeId).filter(Boolean))]
    const tvaMap = new Map(
      (await TvaGroupe.query().whereIn('id', tvaIds)).map((t) => [t.id, Number(t.taux)])
    )

    return sendPaginated(
      ctx,
      produits.map((p) =>
        serializeProduit(
          p,
          {},
          {
            tauxTva: tvaMap.get(p.tvaGroupeId),
            stocksParDepot: stocksMap.get(p.id) ?? [],
          }
        )
      ),
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
        mode_vente: payload.mode_vente ?? payload.modeVente,
      })
      await ajustementManuel(
        payload.id,
        quantite,
        payload.type,
        payload.notes ?? null,
        ctx.auth.getUserOrFail().id,
        undefined,
        payload.depot_id
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
    const tvaGroupe = await getTvaGroupeOrFail(produit.tvaGroupeId)
    return sendSuccess(ctx, serializeProduit(produit, {}, {
      ...produitSerializeOptions(ctx),
      tauxTva: Number(tvaGroupe.taux),
    }))
  }

  async calculPrix(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(produitCalculPrixValidator)

    let tvaGroupe: TvaGroupe
    try {
      tvaGroupe = await getTvaGroupeOrFail(payload.tva_groupe_id)
    } catch {
      return sendError(ctx, 'Groupe TVA introuvable', 422)
    }

    const tauxTva = Number(tvaGroupe.taux)
    const prixAchatHt = payload.prix_achat_ht ?? 0
    const frais = payload.frais ?? 0
    const pricing = calcProduitPricingFromVenteTtc({
      prixAchatHt,
      prixVenteTtc: payload.prix_vente_ttc ?? 0,
      frais,
      tauxTva,
    })

    const canSeePlancher = canViewPlancherCmup(ctx.auth.getUserOrFail())
    return sendSuccess(ctx, {
      tva_groupe: tvaGroupe.serialize(),
      prix_achat_ht: prixAchatHt,
      moyenne_achat_ht: calcCmupHt(prixAchatHt, frais, tauxTva),
      prix_vente_ttc: pricing.prixVenteTtc,
      prix_vente_ht: pricing.prixVenteHt,
      frais,
      prix_achat_ttc: pricing.prixAchatTtc,
      ...(canSeePlancher ? { plancher: pricing.plancher } : {}),
    })
  }
}
