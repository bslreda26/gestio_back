import Fournisseur from '#models/fournisseur'
import FournisseurSolde from '#models/fournisseur_solde'
import { roundMoney } from '#services/pricing_service'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export function readFournisseurSoldePdv(row: Pick<FournisseurSolde, 'solde'> | null | undefined): number {
  return row ? roundMoney(Number(row.solde)) : 0
}

export async function getFournisseurSoldePdv(
  fournisseurId: number,
  pointDeVenteId: number
): Promise<number> {
  const row = await FournisseurSolde.query()
    .where('fournisseur_id', fournisseurId)
    .where('point_de_vente_id', pointDeVenteId)
    .select('solde')
    .first()

  return readFournisseurSoldePdv(row)
}

export async function getFournisseurSoldesPdv(
  pointDeVenteId: number,
  fournisseurIds: number[]
): Promise<Map<number, number>> {
  const soldes = new Map<number, number>()
  for (const id of fournisseurIds) soldes.set(id, 0)
  if (fournisseurIds.length === 0) return soldes

  const rows = await FournisseurSolde.query()
    .where('point_de_vente_id', pointDeVenteId)
    .whereIn('fournisseur_id', fournisseurIds)
    .select('fournisseur_id', 'solde')

  for (const row of rows) {
    soldes.set(row.fournisseurId, readFournisseurSoldePdv(row))
  }

  return soldes
}

async function resolveInitialFournisseurSoldePdv(
  fournisseurId: number,
  trx: TransactionClientContract
): Promise<number> {
  const [countRow] = await FournisseurSolde.query({ client: trx })
    .where('fournisseur_id', fournisseurId)
    .count('* as total')

  if (Number(countRow.$extras.total) > 0) return 0

  const fournisseur = await Fournisseur.query({ client: trx })
    .where('id', fournisseurId)
    .select('solde')
    .first()

  return fournisseur ? roundMoney(Number(fournisseur.solde)) : 0
}

export async function getOrCreateFournisseurSolde(
  fournisseurId: number,
  pointDeVenteId: number,
  trx: TransactionClientContract
): Promise<FournisseurSolde> {
  const existing = await FournisseurSolde.query({ client: trx })
    .where('fournisseur_id', fournisseurId)
    .where('point_de_vente_id', pointDeVenteId)
    .forUpdate()
    .first()

  if (existing) return existing

  const initialSolde = await resolveInitialFournisseurSoldePdv(fournisseurId, trx)

  return FournisseurSolde.create(
    {
      fournisseurId,
      pointDeVenteId,
      solde: String(initialSolde),
    },
    { client: trx }
  )
}

async function syncFournisseurSoldeGlobal(fournisseurId: number, trx: TransactionClientContract) {
  const [row] = await FournisseurSolde.query({ client: trx })
    .where('fournisseur_id', fournisseurId)
    .sum('solde as total')

  const fournisseur = await Fournisseur.query({ client: trx })
    .where('id', fournisseurId)
    .forUpdate()
    .firstOrFail()

  fournisseur.solde = String(roundMoney(Number(row.$extras.total ?? 0)))
  fournisseur.useTransaction(trx)
  await fournisseur.save()
}

/** Ajuste le solde fournisseur pour un PDV (delta positif = dette en hausse). */
export async function adjustFournisseurSoldePdv(
  fournisseurId: number,
  pointDeVenteId: number,
  delta: number,
  trx: TransactionClientContract
): Promise<{ soldeAvant: number; soldeApres: number }> {
  const row = await getOrCreateFournisseurSolde(fournisseurId, pointDeVenteId, trx)
  const soldeAvant = readFournisseurSoldePdv(row)
  const soldeApres = roundMoney(soldeAvant + delta)

  row.solde = String(soldeApres)
  row.useTransaction(trx)
  await row.save()

  await syncFournisseurSoldeGlobal(fournisseurId, trx)

  return { soldeAvant, soldeApres }
}

export async function backfillFournisseurSoldesFromMovements() {
  const { computeFournisseurSoldePdv } = await import('#services/rapport_service')
  const achatPairs = await db
    .from('achats')
    .distinct('fournisseur_id', 'point_de_vente_id')

  const reglementPairs = await db
    .from('reglements')
    .where('type', 'fournisseur')
    .distinct('fournisseur_id', 'point_de_vente_id')

  const pairKeys = new Set<string>()
  const pairs: { fournisseur_id: number; point_de_vente_id: number }[] = []

  for (const row of [...achatPairs, ...reglementPairs]) {
    const key = `${row.fournisseur_id}:${row.point_de_vente_id}`
    if (pairKeys.has(key)) continue
    pairKeys.add(key)
    pairs.push({
      fournisseur_id: Number(row.fournisseur_id),
      point_de_vente_id: Number(row.point_de_vente_id),
    })
  }

  const now = new Date()

  for (const pair of pairs) {
    const solde = await computeFournisseurSoldePdv(pair.fournisseur_id, pair.point_de_vente_id)

    const existing = await db
      .from('fournisseur_soldes')
      .where('fournisseur_id', pair.fournisseur_id)
      .where('point_de_vente_id', pair.point_de_vente_id)
      .first()

    if (existing) {
      await db
        .from('fournisseur_soldes')
        .where('id', existing.id)
        .update({ solde: String(solde), updated_at: now })
    } else {
      await db.table('fournisseur_soldes').insert({
        fournisseur_id: pair.fournisseur_id,
        point_de_vente_id: pair.point_de_vente_id,
        solde: String(solde),
        created_at: now,
        updated_at: now,
      })
    }

    const [sumRow] = await db
      .from('fournisseur_soldes')
      .where('fournisseur_id', pair.fournisseur_id)
      .sum('solde as total')

    await db
      .from('fournisseurs')
      .where('id', pair.fournisseur_id)
      .update({ solde: String(roundMoney(Number(sumRow?.total ?? 0))), updated_at: now })
  }
}
