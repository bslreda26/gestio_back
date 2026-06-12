import Client from '#models/client'
import type Vente from '#models/vente'

export async function serializeVentesForList(ventes: Vente[]) {
  if (ventes.length === 0) return []

  const clientIds = [...new Set(ventes.map((v) => v.clientId))]
  const clients = await Client.query().whereIn('id', clientIds).select('id', 'nom', 'code')
  const clientById = new Map(clients.map((c) => [c.id, c]))

  return ventes.map((vente) => {
    const client = clientById.get(vente.clientId)
    return {
      ...vente.serialize(),
      client: client ? { id: client.id, nom: client.nom, code: client.code } : null,
      clientNom: client?.nom ?? null,
    }
  })
}
