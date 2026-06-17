import Depot from '#models/depot'
import DepotStock from '#models/depot_stock'
import Produit from '#models/produit'
import { serializeDepotStockRow, type SerializedDepotStock } from '#helpers/depot_stock_serializer'
import { convertStockWhenEnablingDetailConfig } from '#services/vente_unite_service'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export class DepotBusinessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DepotBusinessError'
  }
}

export async function generateDepotCode(
  pointDeVenteId: number,
  trx?: TransactionClientContract
): Promise<string> {
  const query = trx ? Depot.query({ client: trx }) : Depot.query()
  const last = await query
    .where('point_de_vente_id', pointDeVenteId)
    .orderBy('id', 'desc')
    .select('code')
    .first()

  if (!last) return '01'

  const match = String(last.code).match(/(\d+)$/)
  const next = match ? Number(match[1]) + 1 : 1
  return String(next).padStart(2, '0')
}

export async function creerDepotParDefaut(
  pointDeVenteId: number,
  nom: string,
  trx?: TransactionClientContract
) {
  const client = trx ? { client: trx } : undefined
  return Depot.create(
    {
      pointDeVenteId,
      code: '01',
      nom,
      adresse: null,
      isDefault: true,
      isActive: true,
    },
    client
  )
}

export async function getDefaultDepot(
  pointDeVenteId: number,
  trx?: TransactionClientContract
): Promise<Depot> {
  const query = trx ? Depot.query({ client: trx }) : Depot.query()
  const depot = await query
    .where('point_de_vente_id', pointDeVenteId)
    .where('is_default', true)
    .where('is_active', true)
    .first()

  if (!depot) {
    throw new DepotBusinessError(`Aucun dépôt par défaut pour le point de vente ${pointDeVenteId}`)
  }

  return depot
}

export async function resolveDepotForProduit(
  produit: Produit,
  depotId: number | undefined,
  trx?: TransactionClientContract
): Promise<Depot> {
  if (depotId) {
    const query = trx ? Depot.query({ client: trx }) : Depot.query()
    const depot = await query
      .where('id', depotId)
      .where('point_de_vente_id', produit.pointDeVenteId)
      .where('is_active', true)
      .first()

    if (!depot) {
      throw new DepotBusinessError('Dépôt introuvable pour ce point de vente')
    }

    return depot
  }

  return getDefaultDepot(produit.pointDeVenteId, trx)
}

export async function assertDepotsMemePointDeVente(
  pointDeVenteId: number,
  depotSourceId: number,
  depotDestId: number,
  trx?: TransactionClientContract
) {
  if (depotSourceId === depotDestId) {
    throw new DepotBusinessError('Les dépôts source et destination doivent être différents')
  }

  const query = trx ? Depot.query({ client: trx }) : Depot.query()
  const depots = await query
    .whereIn('id', [depotSourceId, depotDestId])
    .where('is_active', true)

  if (depots.length !== 2 || depots.some((d) => d.pointDeVenteId !== pointDeVenteId)) {
    throw new DepotBusinessError('Dépôts introuvables pour ce point de vente')
  }
}

export async function resolveDepotForPointDeVente(
  pointDeVenteId: number,
  depotId: number | undefined,
  trx?: TransactionClientContract
): Promise<Depot> {
  if (depotId) {
    const query = trx ? Depot.query({ client: trx }) : Depot.query()
    const depot = await query
      .where('id', depotId)
      .where('point_de_vente_id', pointDeVenteId)
      .where('is_active', true)
      .first()

    if (!depot) {
      throw new DepotBusinessError('Dépôt introuvable pour ce point de vente')
    }

    return depot
  }

  return getDefaultDepot(pointDeVenteId, trx)
}

export async function getDepotStockQuantite(
  produitId: number,
  depotId: number,
  trx?: TransactionClientContract
): Promise<number> {
  const query = trx ? DepotStock.query({ client: trx }) : DepotStock.query()
  const row = await query.where('produit_id', produitId).where('depot_id', depotId).first()
  return row ? Number(row.quantite) : 0
}

export async function getOrCreateDepotStock(
  produitId: number,
  depotId: number,
  trx: TransactionClientContract
) {
  let row = await DepotStock.query({ client: trx })
    .where('produit_id', produitId)
    .where('depot_id', depotId)
    .forUpdate()
    .first()

  if (!row) {
    row = await DepotStock.create(
      {
        produitId,
        depotId,
        quantite: '0',
      },
      { client: trx }
    )
  }

  return row
}

export async function syncProduitStockActuel(
  produitId: number,
  trx?: TransactionClientContract
) {
  const produit = trx
    ? await Produit.query({ client: trx }).where('id', produitId).forUpdate().firstOrFail()
    : await Produit.query().where('id', produitId).forUpdate().firstOrFail()

  let sumQuery = db
    .from('depot_stocks as ds')
    .join('depots as d', 'd.id', 'ds.depot_id')
    .where('ds.produit_id', produitId)
    .where('d.point_de_vente_id', produit.pointDeVenteId)
    .where('d.is_active', true)
    .sum('ds.quantite as total')

  if (trx) {
    sumQuery = sumQuery.useTransaction(trx)
  }

  const [row] = await sumQuery
  produit.stockActuel = String(Number(row?.total ?? 0))
  if (trx) produit.useTransaction(trx)
  await produit.save()
}

export async function getStocksParDepotForProduit(
  produit: Produit
): Promise<SerializedDepotStock[]> {
  const rows = await DepotStock.query()
    .where('produit_id', produit.id)
    .whereHas('depot', (q) => {
      q.where('point_de_vente_id', produit.pointDeVenteId).where('is_active', true)
    })
    .preload('depot')
    .orderBy('depot_id', 'asc')

  return rows.map((row) => serializeDepotStockRow(row, produit))
}

export async function getStocksParDepotForProduits(produitIds: number[]) {
  if (produitIds.length === 0) return new Map<number, SerializedDepotStock[]>()

  const rows = await DepotStock.query()
    .whereIn('produit_id', produitIds)
    .whereHas('depot', (q) => {
      q.where('is_active', true)
    })
    .preload('depot')
    .preload('produit')

  const map = new Map<number, SerializedDepotStock[]>()
  for (const row of rows) {
    const list = map.get(row.produitId) ?? []
    list.push(serializeDepotStockRow(row, row.produit))
    map.set(row.produitId, list)
  }

  return map
}

export async function transfererToutStockDepot(
  depotSourceId: number,
  depotDestId: number,
  userId: number,
  trx: TransactionClientContract
) {
  const source = await Depot.query({ client: trx }).where('id', depotSourceId).firstOrFail()
  await assertDepotsMemePointDeVente(source.pointDeVenteId, depotSourceId, depotDestId, trx)

  const lignes = await DepotStock.query({ client: trx })
    .where('depot_id', depotSourceId)
    .where('quantite', '>', 0)

  const { enregistrerTransfert } = await import('#services/stock_service')

  for (const ligne of lignes) {
    const quantite = Number(ligne.quantite)
    if (quantite <= 0) continue
    await enregistrerTransfert(
      ligne.produitId,
      quantite,
      depotSourceId,
      depotDestId,
      userId,
      'Transfert avant désactivation du dépôt',
      trx
    )
  }
}

export async function listDepotStocksForProduit(produitId: number) {
  return DepotStock.query()
    .where('produit_id', produitId)
    .preload('depot')
    .orderBy('depot_id', 'asc')
}

export async function setDefaultDepot(depotId: number, trx: TransactionClientContract) {
  const depot = await Depot.query({ client: trx }).where('id', depotId).forUpdate().firstOrFail()

  await Depot.query({ client: trx })
    .where('point_de_vente_id', depot.pointDeVenteId)
    .where('is_default', true)
    .update({ isDefault: false })

  depot.isDefault = true
  depot.useTransaction(trx)
  await depot.save()

  return depot
}

export async function convertDepotStocksWhenEnablingDetailConfig(
  produitId: number,
  before: Parameters<typeof convertStockWhenEnablingDetailConfig>[1],
  after: Parameters<typeof convertStockWhenEnablingDetailConfig>[2],
  trx?: TransactionClientContract
) {
  const stockQuery = trx ? DepotStock.query({ client: trx }) : DepotStock.query()
  const rows = await stockQuery.where('produit_id', produitId)

  for (const row of rows) {
    row.quantite = String(
      convertStockWhenEnablingDetailConfig(Number(row.quantite), before, after)
    )
    if (trx) row.useTransaction(trx)
    await row.save()
  }

  await syncProduitStockActuel(produitId, trx)
}
