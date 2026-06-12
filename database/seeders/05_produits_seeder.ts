import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { calcProduitPricing } from '#services/pricing_service'

export default class extends BaseSeeder {
  async run() {
    const now = new Date()
    const pos = await this.client.from('points_de_vente').where('code', '01').first()
    if (!pos) return
    const pointDeVenteId = pos.id as number

    const tva18 = await this.client.from('tva_groupes').where('code', 'TVA18').first()
    const tva9 = await this.client.from('tva_groupes').where('code', 'TVA9').first()
    const tva0 = await this.client.from('tva_groupes').where('code', 'TVA0').first()

    if (!tva18 || !tva9 || !tva0) return

    const categories = await this.client.from('categories').select('id', 'nom')

    const samples = [
      { code: 'PRD-0001', nom: 'Riz 25kg', prix_achat_ht: 12000, prix_vente_ht: 15000, frais: 500, tva: tva18, cat: 'Alimentation', stock: 50 },
      { code: 'PRD-0002', nom: 'Huile 5L', prix_achat_ht: 8000, prix_vente_ht: 10000, frais: 300, tva: tva18, cat: 'Alimentation', stock: 30 },
      { code: 'PRD-0003', nom: 'Sucre 1kg', prix_achat_ht: 600, prix_vente_ht: 800, frais: 50, tva: tva18, cat: 'Alimentation', stock: 100 },
      { code: 'PRD-0004', nom: 'Eau minérale 1.5L', prix_achat_ht: 200, prix_vente_ht: 300, frais: 20, tva: tva9, cat: 'Boissons', stock: 200 },
      { code: 'PRD-0005', nom: 'Jus orange 1L', prix_achat_ht: 500, prix_vente_ht: 750, frais: 30, tva: tva9, cat: 'Boissons', stock: 80 },
      { code: 'PRD-0006', nom: 'Savon liquide', prix_achat_ht: 1500, prix_vente_ht: 2000, frais: 100, tva: tva18, cat: 'Hygiène', stock: 40 },
      { code: 'PRD-0007', nom: 'Détergent 2kg', prix_achat_ht: 2500, prix_vente_ht: 3200, frais: 150, tva: tva18, cat: 'Hygiène', stock: 25 },
      { code: 'PRD-0008', nom: 'Câble USB', prix_achat_ht: 1000, prix_vente_ht: 1500, frais: 100, tva: tva18, cat: 'Électronique', stock: 60 },
      { code: 'PRD-0009', nom: 'Cahier 200 pages', prix_achat_ht: 400, prix_vente_ht: 600, frais: 30, tva: tva0, cat: 'Fournitures', stock: 150 },
      { code: 'PRD-0010', nom: 'Stylo bleu (paquet)', prix_achat_ht: 800, prix_vente_ht: 1200, frais: 50, tva: tva0, cat: 'Fournitures', stock: 90 },
    ]

    for (const p of samples) {
      const exists = await this.client
        .from('produits')
        .where('code', p.code)
        .where('point_de_vente_id', pointDeVenteId)
        .first()
      if (exists) continue

      const categorie = categories.find((c: { nom: string }) => c.nom === p.cat)
      const pricing = calcProduitPricing({
        prixAchatHt: p.prix_achat_ht,
        prixVenteHt: p.prix_vente_ht,
        frais: p.frais,
        tauxTva: Number(p.tva.taux),
      })

      await this.client.table('produits').insert({
        code: p.code,
        point_de_vente_id: pointDeVenteId,
        nom: p.nom,
        categorie_id: categorie?.id ?? null,
        tva_groupe_id: p.tva.id,
        prix_achat_ht: p.prix_achat_ht,
        prix_achat_ttc: pricing.prixAchatTtc,
        prix_vente_ht: p.prix_vente_ht,
        prix_vente_ttc: pricing.prixVenteTtc,
        frais: p.frais,
        plancher: pricing.plancher,
        unite: 'pièce',
        stock_actuel: p.stock,
        stock_minimum: 10,
        stock_maximum: 500,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
    }
  }
}
