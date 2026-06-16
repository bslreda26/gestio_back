import { ACHAT_STATUT } from '#constants/achat_statuts'
import Achat from '#models/achat'
import AchatLigne from '#models/achat_ligne'
import Fournisseur from '#models/fournisseur'
import Produit from '#models/produit'
import User from '#models/user'
import { roundMoney } from '#services/pricing_service'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'

const DEFAULT_POINT_DE_VENTE_ID = 1
const POS_CODE = '01'
const TARGET_COUNT = 1000

function calcLigneMontants(quantite: number, prixUnitaireHt: number, tvaPct: number) {
  const montantHt = roundMoney(quantite * prixUnitaireHt)
  const montantTva = roundMoney(montantHt * (tvaPct / 100))
  const montantTtc = roundMoney(montantHt + montantTva)
  return { montantHt, montantTva, montantTtc }
}

export default class extends BaseSeeder {
  async run() {
    const countRow = await Achat.query()
      .where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID)
      .count('* as total')
    const existingCount = Number(countRow[0].$extras.total)
    if (existingCount >= TARGET_COUNT) {
      return
    }

    const admin = await User.findByOrFail('email', 'admin@gestion.com')
    const fournisseur = await Fournisseur.findByOrFail('code', 'FRN-0001')
    const produits = await Produit.query()
      .where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID)
      .where('is_active', true)
      .orderBy('id', 'asc')
      .limit(TARGET_COUNT)

    if (produits.length === 0) {
      return
    }

    const year = DateTime.now().year
    const tvaPct = 18
    const toCreate = TARGET_COUNT - existingCount

    for (let i = 0; i < toCreate; i++) {
      const sequence = existingCount + i + 1
      const numero = `${POS_CODE}-ACH-${year}-${String(sequence).padStart(4, '0')}`
      const produit = produits[i % produits.length]
      const quantite = 1 + (sequence % 5)
      const prixUnitaireHt = Number(produit.prixAchatHt) || 5000
      const frais = Number(produit.frais) || 0
      const { montantHt, montantTva, montantTtc } = calcLigneMontants(
        quantite,
        prixUnitaireHt,
        tvaPct
      )

      await Achat.transaction(async (trx) => {
        const achat = await Achat.create(
          {
            numero,
            pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
            fournisseurId: fournisseur.id,
            userId: admin.id,
            dateAchat: DateTime.fromISO('2026-01-15').plus({ days: sequence % 180 }),
            dateReception: null,
            statut: ACHAT_STATUT.COMMANDE,
            statutPaiement: 'non_paye',
            sousTotal: montantTtc,
            remiseMontant: 0,
            tvaMontant: montantTva,
            totalTtc: montantTtc,
            montantPaye: 0,
            resteAPayer: 0,
            referenceFournisseur: `REF-${String(sequence).padStart(5, '0')}`,
            notes: null,
          },
          { client: trx }
        )

        await AchatLigne.create(
          {
            achatId: achat.id,
            produitId: produit.id,
            designation: produit.nom,
            modeAchat: 'piece',
            quantite,
            quantiteStock: quantite,
            quantiteRecue: 0,
            quantiteRetournee: 0,
            prixUnitaireHt,
            frais,
            tvaPct,
            montantHt,
            montantTva,
            montantTtc,
          },
          { client: trx }
        )
      })
    }
  }
}
