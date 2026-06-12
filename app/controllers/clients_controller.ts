import Client from '#models/client'
import Vente from '#models/vente'
import Paiement from '#models/paiement'
import { sendError, sendPaginated, sendSuccess } from '#helpers/api_response'
import {
  assertRecordBelongsToPointDeVente,
  requirePointDeVente,
  scopeByPointDeVente,
} from '#helpers/point_de_vente_context'
import { buildMeta, parsePagination } from '#helpers/pagination'
import { generateClientCode } from '#services/code_generator_service'
import {
  clientCreateValidator,
  clientIdValidator,
  clientSearchValidator,
  clientUpdateValidator,
  clientVentesValidator,
} from '#validators/client_validator'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { maskSolde } from '#helpers/solde_visibility'
import { hasUserPermission } from '#services/permission_service'

export default class ClientsController {
  async search(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(clientSearchValidator)
    const { page, limit, offset } = parsePagination(payload)

    const pos = requirePointDeVente(ctx)
    const query = scopeByPointDeVente(Client.query().orderBy('nom', 'asc'), pos.pointDeVenteId)

    if (payload.nom) query.whereILike('nom', `%${payload.nom}%`)
    if (payload.code) query.whereILike('code', `%${payload.code}%`)
    if (payload.telephone) query.whereILike('telephone', `%${payload.telephone}%`)
    if (payload.ville) query.whereILike('ville', `%${payload.ville}%`)
    if (payload.type) query.where('type', payload.type)
    if (payload.is_active !== undefined) query.where('is_active', payload.is_active)
    if (payload.search) {
      const term = `%${payload.search}%`
      query.where((q) => {
        q.whereILike('nom', term)
          .orWhereILike('code', term)
          .orWhereILike('telephone', term)
          .orWhereILike('ville', term)
          .orWhereILike('email', term)
      })
    }

    const total = await query.clone().count('* as total')
    const clients = await query.offset(offset).limit(limit)
    const totalCount = Number(total[0].$extras.total)

    const canSeeSolde = hasUserPermission(ctx.auth.getUserOrFail(), 'clients_solde')
    return sendPaginated(
      ctx,
      clients.map((client) => maskSolde(client.serialize(), canSeeSolde)),
      buildMeta(totalCount, page, limit)
    )
  }

  async show(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(clientIdValidator)
    const client = await Client.find(id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, client, 'Client'))) return

    const recentVentes = await Vente.query()
      .where('client_id', id)
      .orderBy('date_vente', 'desc')
      .limit(5)

    const canSeeSolde = hasUserPermission(ctx.auth.getUserOrFail(), 'clients_solde')
    return sendSuccess(ctx, {
      client: maskSolde(client!.serialize(), canSeeSolde),
      recentVentes,
    })
  }

  async create(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(clientCreateValidator)
    const pos = requirePointDeVente(ctx)
    const code = await generateClientCode(pos.pointDeVenteId)

    const client = await Client.create({
      code,
      pointDeVenteId: pos.pointDeVenteId,
      nom: payload.nom,
      type: payload.type ?? 'B2C',
      email: payload.email ?? null,
      telephone: payload.telephone ?? null,
      adresse: payload.adresse ?? null,
      ville: payload.ville ?? null,
      pays: payload.pays ?? "Côte d'Ivoire",
      creditLimit: payload.credit_limit ?? 0,
      solde: 0,
      notes: payload.notes ?? null,
      isActive: true,
    })

    const canSeeSolde = hasUserPermission(ctx.auth.getUserOrFail(), 'clients_solde')
    return sendSuccess(ctx, maskSolde(client.serialize(), canSeeSolde))
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(clientUpdateValidator)
    const client = await Client.find(payload.id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, client, 'Client'))) return

    client!.merge({
      nom: payload.nom ?? client.nom,
      type: payload.type ?? client.type,
      email: payload.email !== undefined ? payload.email ?? null : client.email,
      telephone: payload.telephone !== undefined ? payload.telephone ?? null : client.telephone,
      adresse: payload.adresse !== undefined ? payload.adresse ?? null : client.adresse,
      ville: payload.ville !== undefined ? payload.ville ?? null : client.ville,
      pays: payload.pays ?? client.pays,
      creditLimit: payload.credit_limit ?? client.creditLimit,
      notes: payload.notes !== undefined ? payload.notes ?? null : client.notes,
      isActive: payload.is_active ?? client.isActive,
    })
    await client!.save()

    const canSeeSolde = hasUserPermission(ctx.auth.getUserOrFail(), 'clients_solde')
    return sendSuccess(ctx, maskSolde(client!.serialize(), canSeeSolde))
  }

  async deactivate(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(clientIdValidator)
    const client = await Client.find(id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, client, 'Client'))) return

    client.isActive = false
    await client.save()

    return sendSuccess(ctx, { message: 'Client désactivé', client })
  }

  async ventes(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(clientVentesValidator)
    const { page, limit, offset } = parsePagination(payload)

    const client = await Client.find(payload.id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, client, 'Client'))) return

    const pos = requirePointDeVente(ctx)
    const query = scopeByPointDeVente(
      Vente.query().where('client_id', payload.id).orderBy('date_vente', 'desc'),
      pos.pointDeVenteId
    )
    if (payload.statut) query.where('statut', payload.statut)
    if (payload.date_from) query.where('date_vente', '>=', payload.date_from.toISODate()!)
    if (payload.date_to) query.where('date_vente', '<=', payload.date_to.toISODate()!)

    const total = await query.clone().count('* as total')
    const ventes = await query.offset(offset).limit(limit)

    return sendPaginated(ctx, ventes, buildMeta(Number(total[0].$extras.total), page, limit))
  }

  async solde(ctx: HttpContext) {
    const { id } = await ctx.request.validateUsing(clientIdValidator)
    const client = await Client.find(id)
    if (!(await assertRecordBelongsToPointDeVente(ctx, client, 'Client'))) return

    const pos = requirePointDeVente(ctx)
    const venteIds = await scopeByPointDeVente(Vente.query().where('client_id', id), pos.pointDeVenteId).select('id')
    const ids = venteIds.map((v) => v.id)

    let paiements: InstanceType<typeof Paiement>[] = []
    if (ids.length > 0) {
      paiements = await Paiement.query()
        .where('type', 'vente')
        .whereIn('reference_id', ids)
        .orderBy('date_paiement', 'desc')
        .limit(20)
    }

    const creances = await db
      .from('ventes')
      .where('client_id', id)
      .where('point_de_vente_id', pos.pointDeVenteId)
      .whereIn('statut', ['non_valide', 'valide'])
      .where('reste_a_payer', '>', 0)
      .sum('reste_a_payer as total')

    return sendSuccess(ctx, {
      client: { id: client.id, nom: client.nom, code: client.code, solde: client.solde },
      totalCreances: Number(creances[0]?.total ?? 0),
      paiements,
    })
  }
}
