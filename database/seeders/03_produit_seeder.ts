import Category from '#models/category'
import Produit from '#models/produit'
import TvaGroupe from '#models/tva_groupe'
import { calcProduitPricingFromVenteTtc } from '#services/pricing_service'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

const DEFAULT_POINT_DE_VENTE_ID = 1
const TARGET_COUNT = 1000

type ProduitSeed = {
  code: string
  nom: string
  prixAchatHt: number
  frais: number
  prixVenteTtc: number
  stockActuel: number
}

const TEST_PRODUCTS: ProduitSeed[] = [
  {
    code: 'PRD-0001',
    nom: 'Ciment 50kg',
    prixAchatHt: 10000,
    frais: 500,
    prixVenteTtc: 17700,
    stockActuel: 100,
  },
  {
    code: 'PRD-0002',
    nom: 'Tôle galvanisée',
    prixAchatHt: 10000,
    frais: 500,
    prixVenteTtc: 17700,
    stockActuel: 50,
  },
  {
    code: 'PRD-0003',
    nom: 'Peinture 20L',
    prixAchatHt: 8000,
    frais: 500,
    prixVenteTtc: 11800,
    stockActuel: 20,
  },
]

function padCode(index: number): string {
  return `PRD-${String(index).padStart(4, '0')}`
}

function buildProduitRow(
  seed: ProduitSeed,
  tvaGroupeId: number,
  categorieId: number | null,
  now: Date
) {
  const pricing = calcProduitPricingFromVenteTtc({
    prixAchatHt: seed.prixAchatHt,
    prixVenteTtc: seed.prixVenteTtc,
    frais: seed.frais,
    tauxTva: 18,
  })

  return {
    point_de_vente_id: DEFAULT_POINT_DE_VENTE_ID,
    code: seed.code,
    nom: seed.nom,
    description: null,
    categorie_id: categorieId,
    tva_groupe_id: tvaGroupeId,
    prix_achat_ht: seed.prixAchatHt,
    prix_achat_ttc: pricing.prixAchatTtc,
    dernier_prix_achat_ht: seed.prixAchatHt,
    prix_vente_ht: pricing.prixVenteHt,
    prix_vente_ttc: pricing.prixVenteTtc,
    frais: seed.frais,
    plancher: pricing.plancher,
    unite: 'pièce',
    unite_gros: null,
    contenance: 1,
    vente_au_detail: false,
    stock_actuel: seed.stockActuel,
    stock_minimum: 0,
    stock_maximum: 0,
    is_active: true,
    created_at: now,
    updated_at: now,
  }
}

export default class extends BaseSeeder {
  async run() {
    const countRow = await Produit.query()
      .where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID)
      .count('* as total')
    const existingCount = Number(countRow[0].$extras.total)
    if (existingCount >= TARGET_COUNT) {
      return
    }

    const tvaGroupe = await TvaGroupe.findByOrFail('code', 'TVA18')
    const category = await Category.query()
      .where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID)
      .orderBy('id', 'asc')
      .first()
    const categorieId = category?.id ?? null
    const now = new Date()
    const existingCodes = new Set(
      (
        await Produit.query()
          .where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID)
          .select('code')
      ).map((produit) => produit.code)
    )
    const rows: Record<string, unknown>[] = []

    for (const seed of TEST_PRODUCTS) {
      if (!existingCodes.has(seed.code)) {
        rows.push(buildProduitRow(seed, tvaGroupe.id, categorieId, now))
      }
    }

    for (let index = 4; index <= TARGET_COUNT; index++) {
      const code = padCode(index)
      if (existingCodes.has(code)) {
        continue
      }

      const prixAchatHt = 5000 + (index % 50) * 100
      const frais = (index % 10) * 50
      const prixVenteTtc = Math.round((prixAchatHt + frais) * 1.35 * 1.18)

      rows.push(
        buildProduitRow(
          {
            code,
            nom: `Article ${index}`,
            prixAchatHt,
            frais,
            prixVenteTtc,
            stockActuel: 10 + (index % 20),
          },
          tvaGroupe.id,
          categorieId,
          now
        )
      )
    }

    if (rows.length === 0) {
      return
    }

    const chunkSize = 100
    for (let offset = 0; offset < rows.length; offset += chunkSize) {
      await db.table('produits').multiInsert(rows.slice(offset, offset + chunkSize))
    }
  }
}
