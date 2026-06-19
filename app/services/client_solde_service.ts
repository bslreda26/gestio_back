import Client from '#models/client'
import { roundMoney } from '#services/pricing_service'

/** Solde client matérialisé en base (maintenu par vente_service / reglement_service). */
export function readClientSolde(client: Pick<Client, 'solde'>): number {
  return roundMoney(Number(client.solde))
}

export async function getClientSoldesByIds(clientIds: number[]): Promise<Map<number, number>> {
  const soldes = new Map<number, number>()
  if (clientIds.length === 0) return soldes

  const rows = await Client.query().whereIn('id', clientIds).select('id', 'solde')
  for (const row of rows) {
    soldes.set(row.id, readClientSolde(row))
  }

  return soldes
}
