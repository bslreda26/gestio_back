import Category from '#models/category'
import Client from '#models/client'
import Caisse from '#models/caisse'
import Fournisseur from '#models/fournisseur'
import TvaGroupe from '#models/tva_groupe'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

const DEFAULT_POINT_DE_VENTE_ID = 1

export default class extends BaseSeeder {
  async run() {
    let tvaGroupe = await TvaGroupe.findBy('code', 'TVA18')
    if (!tvaGroupe) {
      tvaGroupe = await TvaGroupe.create({
        code: 'TVA18',
        libelle: 'TVA 18%',
        taux: 18,
        isActive: true,
      })
    }

    let category = await Category.query()
      .where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID)
      .where('nom', 'Général')
      .first()
    if (!category) {
      category = await Category.create({
        pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
        nom: 'Général',
        description: 'Catégorie par défaut',
      })
    }

    let client = await Client.query()
      .where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID)
      .where('code', 'CLI-0001')
      .first()
    if (!client) {
      client = await Client.create({
        pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
        code: 'CLI-0001',
        nom: 'Client comptoir',
        email: 'client@gestion.com',
        telephone: '+2250700000001',
        type: 'B2C',
        pays: "Côte d'Ivoire",
        creditLimit: 0,
        solde: 0,
        isActive: true,
      })
    }

    let fournisseur = await Fournisseur.findBy('code', 'FRN-0001')
    if (!fournisseur) {
      fournisseur = await Fournisseur.create({
        code: 'FRN-0001',
        nom: 'Fournisseur principal',
        email: 'fournisseur@gestion.com',
        telephone: '+2250700000002',
        pays: "Côte d'Ivoire",
        solde: 0,
        isActive: true,
      })
    }

    const caisse = await Caisse.query()
      .where('point_de_vente_id', DEFAULT_POINT_DE_VENTE_ID)
      .first()
    if (!caisse) {
      await Caisse.create({
        pointDeVenteId: DEFAULT_POINT_DE_VENTE_ID,
        nom: 'Caisse principale',
        soldeActuel: 0,
        isActive: true,
      })
    }

    void tvaGroupe
    void category
    void client
    void fournisseur
  }
}
