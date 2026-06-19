import Depot from '#models/depot'
import DepotStock from '#models/depot_stock'
import Produit from '#models/produit'
import { sendError, sendPaginated, sendSuccess } from '#helpers/api_response'
import {
  assertRecordBelongsToPointDeVente,
  requirePointDeVente,
  scopeByPointDeVente,
} from '#helpers/point_de_vente_context'
import { buildMeta, parsePagination } from '#helpers/pagination'
import { serializeProduit } from '#helpers/produit_serializer'
import {
  generateDepotCode,
  setDefaultDepot,
  transfererToutStockDepot,
} from '#services/depot_service'
import { enregistrerTransfert } from '#services/stock_service'
import {
  depotCreateValidator,
  depotDeactivateValidator,
  depotIdValidator,
  depotSearchValidator,
  depotStockSearchValidator,
  depotTransfertValidator,
  depotUpdateValidator,
} from '#validators/depot_validator'
import type { HttpContext } from '@adonisjs/core/http'

function serializeDepot(depot: Depot) {
  return {
    id: depot.id,
    point_de_vente_id: depot.pointDeVenteId,
    code: depot.code,
    nom: depot.nom,
    adresse: depot.adresse,
    is_default: Boolean(depot.isDefault),
    is_active: Boolean(depot.isActive),
    created_at: depot.createdAt,
    updated_at: depot.updatedAt,
  }
}

export default class DepotsController {
  async search(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(depotSearchValidator)
    const { page, limit, offset } = parsePagination(payload)
    const pos = requirePointDeVente(ctx)

    const query = scopeByPointDeVente(Depot.query().orderBy('code', 'asc'), pos.pointDeVenteId)

    if (payload.nom) query.whereILike('nom', `%${payload.nom}%`)
    if (payload.code) query.whereILike('code', `%${payload.code}%`)
    if (payload.is_active !== undefined) query.where('is_active', payload.is_active)
    if (payload.search) {
      const term = `%${payload.search}%`
      query.where((q) => {
        q.whereILike('nom', term).orWhereILike('code', term)
      })
    }

    const total = await query.clone().count('* as total')
    const depots = await query.offset(offset).limit(limit)

    return sendPaginated(
      ctx,
      depots.map(serializeDepot),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }

  async show(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(depotIdValidator)
    const depot = await Depot.find(id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, depot, 'Dépôt'))) return

    return sendSuccess(ctx, serializeDepot(depot!))
  }

  async create(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(depotCreateValidator)
    const pos = requirePointDeVente(ctx)

    const code = payload.code ?? (await generateDepotCode(pos.pointDeVenteId))
    const duplicate = await Depot.query()
      .where('point_de_vente_id', pos.pointDeVenteId)
      .where('code', code)
      .first()

    if (duplicate) {
      return sendError(ctx, 'Ce code dépôt est déjà utilisé', 422)
    }

    const isDefault = payload.is_default ?? false

    const depot = await Depot.transaction(async (trx) => {
      if (isDefault) {
        await Depot.query({ client: trx })
          .where('point_de_vente_id', pos.pointDeVenteId)
          .where('is_default', true)
          .update({ isDefault: false })
      }

      return Depot.create(
        {
          pointDeVenteId: pos.pointDeVenteId,
          code,
          nom: payload.nom,
          adresse: payload.adresse ?? null,
          isDefault,
          isActive: true,
        },
        { client: trx }
      )
    })

    return sendSuccess(ctx, serializeDepot(depot))
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(depotUpdateValidator)
    const depot = await Depot.find(payload.id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, depot, 'Dépôt'))) return

    if (payload.code && payload.code !== depot!.code) {
      const duplicate = await Depot.query()
        .where('point_de_vente_id', depot!.pointDeVenteId)
        .where('code', payload.code)
        .whereNot('id', depot!.id)
        .first()
      if (duplicate) {
        return sendError(ctx, 'Ce code dépôt est déjà utilisé', 422)
      }
      depot!.code = payload.code
    }

    if (payload.nom !== undefined) depot!.nom = payload.nom
    if (payload.adresse !== undefined) depot!.adresse = payload.adresse ?? null
    if (payload.is_active !== undefined) depot!.isActive = payload.is_active

    if (payload.is_default) {
      await Depot.transaction(async (trx) => {
        depot!.useTransaction(trx)
        await depot!.save()
        await setDefaultDepot(depot!.id, trx)
      })
      await depot!.refresh()
    } else {
      await depot!.save()
    }

    return sendSuccess(ctx, serializeDepot(depot!))
  }

  async deactivate(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(depotDeactivateValidator)
    const depot = await Depot.find(payload.id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, depot, 'Dépôt'))) return

    if (depot!.isDefault) {
      return sendError(ctx, 'Impossible de désactiver le dépôt par défaut', 422)
    }

    const stockPositif = await DepotStock.query()
      .where('depot_id', depot!.id)
      .where('quantite', '>', 0)
      .first()

    if (stockPositif && !payload.transfer_to_depot_id) {
      return sendError(
        ctx,
        'Ce dépôt contient du stock — indiquez transfer_to_depot_id pour transférer avant désactivation',
        422
      )
    }

    if (stockPositif && payload.transfer_to_depot_id) {
      if (payload.transfer_to_depot_id === depot!.id) {
        return sendError(ctx, 'Le dépôt de destination doit être différent', 422)
      }
      const dest = await Depot.find(payload.transfer_to_depot_id)
      if (!(await assertRecordBelongsToPointDeVente(ctx, dest, 'Dépôt de destination'))) return
      if (!dest!.isActive) {
        return sendError(ctx, 'Le dépôt de destination est inactif', 422)
      }

      await Depot.transaction(async (trx) => {
        await transfererToutStockDepot(
          depot!.id,
          payload.transfer_to_depot_id!,
          ctx.auth.getUserOrFail().id,
          trx
        )
        depot!.useTransaction(trx)
        depot!.isActive = false
        await depot!.save()
      })
    } else {
      depot!.isActive = false
      await depot!.save()
    }

    await depot!.refresh()

    return sendSuccess(ctx, {
      message: 'Dépôt désactivé',
      depot: serializeDepot(depot!),
    })
  }

  async transfert(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(depotTransfertValidator)
    const produit = await Produit.find(payload.produit_id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, produit, 'Produit'))) return

    const [source, dest] = await Promise.all([
      Depot.find(payload.depot_source_id),
      Depot.find(payload.depot_dest_id),
    ])
    if (!(await assertRecordBelongsToPointDeVente(ctx, source, 'Dépôt source'))) return
    if (!(await assertRecordBelongsToPointDeVente(ctx, dest, 'Dépôt destination'))) return
    if (!source!.isActive || !dest!.isActive) {
      return sendError(ctx, 'Les dépôts doivent être actifs', 422)
    }

    try {
      const updated = await enregistrerTransfert(
        payload.produit_id,
        payload.quantite,
        payload.depot_source_id,
        payload.depot_dest_id,
        ctx.auth.getUserOrFail().id,
        payload.notes ?? null
      )
      return sendSuccess(ctx, {
        message: 'Transfert enregistré',
        produit: serializeProduit(updated),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'StockInsuffisantError') {
        return sendError(ctx, error.message, 422)
      }
      throw error
    }
  }

  async stocks(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(depotStockSearchValidator)
    const depot = await Depot.find(payload.depot_id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, depot, 'Dépôt'))) return

    const { page, limit, offset } = parsePagination(payload)
    const query = DepotStock.query()
      .where('depot_id', depot!.id)
      .where('quantite', '>', 0)
      .orderBy('produit_id', 'asc')

    if (payload.search) {
      const term = `%${payload.search}%`
      query.whereIn('produit_id', (sub) => {
        sub
          .from('produits')
          .select('id')
          .where('point_de_vente_id', depot!.pointDeVenteId)
          .where((q) => {
            q.whereILike('nom', term).orWhereILike('code', term)
          })
      })
    }

    const total = await query.clone().count('* as total')
    const rows = await query.preload('produit').offset(offset).limit(limit)

    return sendPaginated(
      ctx,
      rows.map((row) => ({
        produit: serializeProduit(row.produit),
        quantite: Number(row.quantite),
      })),
      buildMeta(Number(total[0].$extras.total), page, limit)
    )
  }
}
