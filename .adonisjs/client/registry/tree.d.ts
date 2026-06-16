/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  auth: {
    login: typeof routes['auth.login']
    logout: typeof routes['auth.logout']
    me: typeof routes['auth.me']
    changePassword: typeof routes['auth.change_password']
  }
  pointsDeVente: {
    search: typeof routes['points_de_vente.search']
    show: typeof routes['points_de_vente.show']
    create: typeof routes['points_de_vente.create']
    update: typeof routes['points_de_vente.update']
    deactivate: typeof routes['points_de_vente.deactivate']
  }
  users: {
    search: typeof routes['users.search']
    show: typeof routes['users.show']
    create: typeof routes['users.create']
    update: typeof routes['users.update']
    deactivate: typeof routes['users.deactivate']
    permissionsCatalog: typeof routes['users.permissions_catalog']
    permissionsShow: typeof routes['users.permissions_show']
    permissionsUpdate: typeof routes['users.permissions_update']
  }
  fneConfig: {
    show: typeof routes['fne_config.show']
    upsert: typeof routes['fne_config.upsert']
  }
  admin: {
    tvaGroupes: {
      search: typeof routes['admin.tva_groupes.search']
      show: typeof routes['admin.tva_groupes.show']
      create: typeof routes['admin.tva_groupes.create']
      update: typeof routes['admin.tva_groupes.update']
      deactivate: typeof routes['admin.tva_groupes.deactivate']
    }
    categories: {
      search: typeof routes['admin.categories.search']
      show: typeof routes['admin.categories.show']
      create: typeof routes['admin.categories.create']
      update: typeof routes['admin.categories.update']
      delete: typeof routes['admin.categories.delete']
    }
    depenseCategories: {
      search: typeof routes['admin.depense_categories.search']
      show: typeof routes['admin.depense_categories.show']
      create: typeof routes['admin.depense_categories.create']
      update: typeof routes['admin.depense_categories.update']
      delete: typeof routes['admin.depense_categories.delete']
    }
  }
  clients: {
    clients: {
      search: typeof routes['clients.clients.search']
      show: typeof routes['clients.clients.show']
      create: typeof routes['clients.clients.create']
      update: typeof routes['clients.clients.update']
      deactivate: typeof routes['clients.clients.deactivate']
      ventes: typeof routes['clients.clients.ventes']
      solde: typeof routes['clients.clients.solde']
    }
  }
  fournisseurs: {
    fournisseurs: {
      search: typeof routes['fournisseurs.fournisseurs.search']
      show: typeof routes['fournisseurs.fournisseurs.show']
      create: typeof routes['fournisseurs.fournisseurs.create']
      update: typeof routes['fournisseurs.fournisseurs.update']
      deactivate: typeof routes['fournisseurs.fournisseurs.deactivate']
      achats: typeof routes['fournisseurs.fournisseurs.achats']
    }
  }
  categories: {
    categories: {
      search: typeof routes['categories.categories.search']
      show: typeof routes['categories.categories.show']
      create: typeof routes['categories.categories.create']
      update: typeof routes['categories.categories.update']
      delete: typeof routes['categories.categories.delete']
    }
  }
  tvaGroupes: {
    index: typeof routes['tva_groupes.index']
    show: typeof routes['tva_groupes.show']
  }
  produits: {
    produits: {
      search: typeof routes['produits.produits.search']
      show: typeof routes['produits.produits.show']
      create: typeof routes['produits.produits.create']
      update: typeof routes['produits.produits.update']
      deactivate: typeof routes['produits.produits.deactivate']
      alertes: typeof routes['produits.produits.alertes']
      ajustement: typeof routes['produits.produits.ajustement']
      calculPrix: typeof routes['produits.produits.calcul_prix']
    }
  }
  ventes: {
    search: typeof routes['ventes.search']
    getByCriteria: typeof routes['ventes.get_by_criteria']
    show: typeof routes['ventes.show']
    ligneInfo: typeof routes['ventes.ligne_info']
    create: typeof routes['ventes.create']
    update: typeof routes['ventes.update']
    annuler: typeof routes['ventes.annuler']
    convertirFacture: typeof routes['ventes.convertir_facture']
    valider: typeof routes['ventes.valider']
    delete: typeof routes['ventes.delete']
    retour: typeof routes['ventes.retour']
    paiement: typeof routes['ventes.paiement']
    paiementsSearch: typeof routes['ventes.paiements_search']
    document: typeof routes['ventes.document']
    imprimer: typeof routes['ventes.imprimer']
    certify: typeof routes['ventes.certify']
    lock: typeof routes['ventes.lock']
    lockRenew: typeof routes['ventes.lock_renew']
    unlock: typeof routes['ventes.unlock']
  }
  reglements: {
    client: {
      create: typeof routes['reglements.client.create']
      search: typeof routes['reglements.client.search']
      show: typeof routes['reglements.client.show']
    }
    fournisseur: {
      create: typeof routes['reglements.fournisseur.create']
      search: typeof routes['reglements.fournisseur.search']
      show: typeof routes['reglements.fournisseur.show']
    }
  }
  achats: {
    search: typeof routes['achats.search']
    getByCriteria: typeof routes['achats.get_by_criteria']
    show: typeof routes['achats.show']
    ligneInfo: typeof routes['achats.ligne_info']
    create: typeof routes['achats.create']
    update: typeof routes['achats.update']
    annuler: typeof routes['achats.annuler']
    recevoir: typeof routes['achats.recevoir']
    retour: typeof routes['achats.retour']
    paiement: typeof routes['achats.paiement']
  }
  caisse: {
    solde: typeof routes['caisse.solde']
    mouvements: {
      search: typeof routes['caisse.mouvements.search']
      show: typeof routes['caisse.mouvements.show']
    }
    getByCriteria: typeof routes['caisse.get_by_criteria']
    ouverture: typeof routes['caisse.ouverture']
    fermeture: typeof routes['caisse.fermeture']
    session: typeof routes['caisse.session']
    sessions: {
      search: typeof routes['caisse.sessions.search']
      getByCriteria: typeof routes['caisse.sessions.get_by_criteria']
      show: typeof routes['caisse.sessions.show']
    }
  }
  depenseCategories: {
    index: typeof routes['depense_categories.index']
  }
  depenses: {
    search: typeof routes['depenses.search']
    show: typeof routes['depenses.show']
    create: typeof routes['depenses.create']
    update: typeof routes['depenses.update']
    delete: typeof routes['depenses.delete']
  }
  stock: {
    search: typeof routes['stock.search']
    mouvements: {
      search: typeof routes['stock.mouvements.search']
    }
    valorisation: typeof routes['stock.valorisation']
    alertes: typeof routes['stock.alertes']
  }
  rapports: {
    caisse: typeof routes['rapports.caisse']
    stockActuel: typeof routes['rapports.stock_actuel']
    valeurStock: typeof routes['rapports.valeur_stock']
    balanceClients: typeof routes['rapports.balance_clients']
    releveClient: typeof routes['rapports.releve_client']
    depenses: typeof routes['rapports.depenses']
    chiffreAffaires: typeof routes['rapports.chiffre_affaires']
    balanceFournisseurs: typeof routes['rapports.balance_fournisseurs']
    releveFournisseur: typeof routes['rapports.releve_fournisseur']
    reglementClients: typeof routes['rapports.reglement_clients']
    reglementFournisseurs: typeof routes['rapports.reglement_fournisseurs']
  }
}
