import { VENTE_STATUT } from '#constants/vente_statuts'
import Client from '#models/client'
import Produit from '#models/produit'
import User from '#models/user'
import Vente from '#models/vente'
import { creerVente } from '#services/vente_service'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'

const DEFAULT_POINT_DE_VENTE_ID = 1
const POS_CODE = '01'
const TARGET_COUNT = 100

export default class extends BaseSeeder {
  async run() {
    const countRow = await Vente.query()
      .where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID)
      .count('* as total')
    const existingCount = Number(countRow[0].$extras.total)
    if (existingCount >= TARGET_COUNT) {
      return
    }

    const admin = await User.findByOrFail('email', 'admin@gestion.com')
    const client = await Client.query()
      .where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID)
      .where('code', 'CLI-0001')
      .firstOrFail()
    const produits = await Produit.query()
      .where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID)
      .where('is_active', true)
      .orderBy('id', 'asc')
      .limit(TARGET_COUNT)

    if (produits.length === 0) {
      return
    }

    const toCreate = TARGET_COUNT - existingCount

    for (let i = 0; i < toCreate; i++) {
      const sequence = existingCount + i + 1
      const produit = produits[i % produits.length]
      const quantite = 1 + (sequence % 3)

      await creerVente(
        {
          statut: VENTE_STATUT.DEVIS,
          client_id: client.id,
          date_vente: DateTime.fromISO('2026-02-01').plus({ days: sequence % 90 }),
          lignes: [{ produit_id: produit.id, quantite }],
        },
        admin.id,
        {
          pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
          pointDeVenteCode: POS_CODE,
        }
      )
    }
  }
}
