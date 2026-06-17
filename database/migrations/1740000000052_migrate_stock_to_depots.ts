import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.defer(async (db) => {
      const now = new Date()
      const points = await db.from('points_de_vente').select('id', 'nom')

      const defaultDepotByPos = new Map<number, number>()

      for (const pos of points) {
        const [depotId] = await db.table('depots').insert({
          point_de_vente_id: pos.id,
          code: '01',
          nom: `Dépôt principal — ${pos.nom}`,
          adresse: null,
          is_default: true,
          is_active: true,
          created_at: now,
          updated_at: now,
        })
        defaultDepotByPos.set(pos.id, depotId)
      }

      const produits = await db
        .from('produits')
        .select('id', 'point_de_vente_id', 'stock_actuel')

      for (const produit of produits) {
        const depotId = defaultDepotByPos.get(produit.point_de_vente_id)
        if (!depotId) continue

        const quantite = Number(produit.stock_actuel ?? 0)
        if (quantite === 0) continue

        await db.table('depot_stocks').insert({
          depot_id: depotId,
          produit_id: produit.id,
          quantite,
          created_at: now,
          updated_at: now,
        })
      }

      for (const [posId, depotId] of defaultDepotByPos) {
        await db.rawQuery(
          `
          UPDATE stock_mouvements sm
          INNER JOIN produits p ON p.id = sm.produit_id
          SET sm.depot_id = ?
          WHERE p.point_de_vente_id = ? AND sm.depot_id IS NULL
        `,
          [depotId, posId]
        )
      }
    })
  }

  async down() {
    await this.defer(async (db) => {
      await db.from('depot_stocks').delete()
      await db.from('depots').delete()
      await db.from('stock_mouvements').update({ depot_id: null })
    })
  }
}
