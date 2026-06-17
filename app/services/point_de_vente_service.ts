import Caisse from '#models/caisse'
import PointDeVente from '#models/point_de_vente'
import { creerDepotParDefaut } from '#services/depot_service'
import db from '@adonisjs/lucid/services/db'

export async function generatePointDeVenteCode(): Promise<string> {
  const row = await db
    .from('points_de_vente')
    .orderBy('id', 'desc')
    .select('code')
    .first()

  if (!row) return '01'

  const match = String(row.code).match(/(\d+)$/)
  const next = match ? Number(match[1]) + 1 : 1
  return String(next).padStart(2, '0')
}

export async function creerPointDeVente(data: {
  code: string
  nom: string
  adresse?: string | null
  ville?: string | null
  telephone?: string | null
  point_of_sale?: string | null
  establishment?: string | null
  timbre_reference?: string | null
}) {
  return db.transaction(async (trx) => {
    const pos = await PointDeVente.create(
      {
        code: data.code,
        nom: data.nom,
        adresse: data.adresse ?? null,
        ville: data.ville ?? null,
        telephone: data.telephone ?? null,
        pointOfSale: data.point_of_sale ?? data.nom,
        establishment: data.establishment ?? data.nom,
        timbreReference: data.timbre_reference ?? null,
        isActive: true,
      },
      { client: trx }
    )

    await Caisse.create(
      {
        nom: `Caisse ${data.nom}`,
        soldeActuel: 0,
        isActive: true,
        pointDeVenteId: pos.id,
      },
      { client: trx }
    )

    await creerDepotParDefaut(pos.id, `Dépôt principal — ${data.nom}`, trx)

    return pos
  })
}
