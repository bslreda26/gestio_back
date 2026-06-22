import PointDeVente from '#models/point_de_vente'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export function isTimbreProduitCode(
  code: string | null | undefined,
  timbreReference: string | null | undefined
): boolean {
  const ref = timbreReference?.trim()
  if (!ref) return false
  return (code ?? '').trim() === ref
}

export async function resolveTimbreReference(
  pointDeVenteId: number,
  trx?: TransactionClientContract
): Promise<string | null> {
  const query = trx ? PointDeVente.query({ client: trx }) : PointDeVente.query()
  const pos = await query.where('id', pointDeVenteId).first()
  return pos?.timbreReference?.trim() || null
}
