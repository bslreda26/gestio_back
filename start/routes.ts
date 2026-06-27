/*
|--------------------------------------------------------------------------
| Routes — Gestion Commerciale API
|--------------------------------------------------------------------------
|
| Convention: GET + POST only (no PUT/PATCH/DELETE).
| - POST /resource/search  → list with criteria in body
| - POST /resource/show    → get by { id }
| - POST /resource/create  → create
| - POST /resource/update  → update
| - POST /resource/deactivate → soft delete
| - GET  → simple reads without search payload
|
| Base URL: /api/v1
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import db from '@adonisjs/lucid/services/db'

const ApikeysController = () => import('#controllers/apikeys_controller')
const AuthController = () => import('#controllers/auth_controller')
const ClientsController = () => import('#controllers/clients_controller')
const FournisseursController = () => import('#controllers/fournisseurs_controller')
const CategoriesController = () => import('#controllers/categories_controller')
const TvaGroupesController = () => import('#controllers/tva_groupes_controller')
const ProduitsController = () => import('#controllers/produits_controller')
const VentesController = () => import('#controllers/ventes_controller')
const CaisseController = () => import('#controllers/caisse_controller')
const AchatsController = () => import('#controllers/achats_controller')
const DepensesController = () => import('#controllers/depenses_controller')
const DepenseCategoriesController = () => import('#controllers/depense_categories_controller')
const StockController = () => import('#controllers/stock_controller')
const DepotsController = () => import('#controllers/depots_controller')
const RapportsController = () => import('#controllers/rapports_controller')
const ImportsController = () => import('#controllers/imports_controller')
const UsersController = () => import('#controllers/users_controller')
const PointsDeVenteController = () => import('#controllers/points_de_vente_controller')
const ReglementsController = () => import('#controllers/reglements_controller')

router.get('/health', async ({ response }) => {
  try {
    await db.rawQuery('SELECT 1 AS ok')
    return { status: 'ok', database: 'connected' }
  } catch {
    return response.status(503).send({ status: 'degraded', database: 'unreachable' })
  }
})

router
  .group(() => {
    // ── Auth (public + protected) ──────────────────────────────────────────
    router
      .group(() => {
        router.post('login', [AuthController, 'login'])
        router
          .group(() => {
            router.post('logout', [AuthController, 'logout'])
            router.get('me', [AuthController, 'me'])
            router.post('change-password', [AuthController, 'changePassword'])
          })
          .use(middleware.auth())
      })
      .prefix('auth')

    // ── Admin (auth, sans contexte point de vente) ─────────────────────────
    router
      .group(() => {
        router
          .group(() => {
            router.post('search', [PointsDeVenteController, 'search']).as('search')
            router.post('show', [PointsDeVenteController, 'show']).as('show')
            router.post('create', [PointsDeVenteController, 'create']).as('create')
            router.post('update', [PointsDeVenteController, 'update']).as('update')
            router.post('deactivate', [PointsDeVenteController, 'deactivate']).as('deactivate')
          })
          .prefix('points-de-vente')
          .as('points_de_vente')
          .use(middleware.role({ permission: 'points_de_vente' }))

        router
          .group(() => {
            router.post('search', [UsersController, 'search']).as('search')
            router.post('show', [UsersController, 'show']).as('show')
            router.post('create', [UsersController, 'create']).as('create')
            router.post('update', [UsersController, 'update']).as('update')
            router.post('deactivate', [UsersController, 'deactivate']).as('deactivate')
            router
              .post('permissions-catalog', [UsersController, 'permissionsCatalog'])
              .as('permissions_catalog')
            router
              .post('permissions/show', [UsersController, 'permissionsShow'])
              .as('permissions_show')
            router
              .post('permissions/update', [UsersController, 'permissionsUpdate'])
              .as('permissions_update')
          })
          .prefix('users')
          .as('users')
          .use(middleware.role({ permission: 'users' }))

        router
          .group(() => {
            router.post('show', [ApikeysController, 'show']).as('show')
            router.post('upsert', [ApikeysController, 'upsert']).as('upsert')
          })
          .prefix('fne-config')
          .as('fne_config')
          .use(middleware.role({ permission: 'fne_admin' }))

        router
          .group(() => {
            router
              .group(() => {
                router
                  .post('search', [TvaGroupesController, 'search'])
                  .as('search')
                  .use(middleware.role({ permission: 'tva_admin' }))
                router
                  .post('show', [TvaGroupesController, 'show'])
                  .as('show')
                  .use(middleware.role({ permission: 'tva_admin' }))
                router
                  .post('create', [TvaGroupesController, 'create'])
                  .as('create')
                  .use(middleware.role({ permission: 'tva_admin' }))
                router
                  .post('update', [TvaGroupesController, 'update'])
                  .as('update')
                  .use(middleware.role({ permission: 'tva_admin' }))
                router
                  .post('deactivate', [TvaGroupesController, 'deactivate'])
                  .as('deactivate')
                  .use(middleware.role({ permission: 'tva_admin' }))
              })
              .prefix('tva-groupes')
              .as('tva_groupes')

            router
              .group(() => {
                router
                  .post('search', [CategoriesController, 'search'])
                  .as('search')
                  .use(middleware.role({ permission: 'categories_admin' }))
                router
                  .post('show', [CategoriesController, 'show'])
                  .as('show')
                  .use(middleware.role({ permission: 'categories_admin' }))
                router
                  .post('create', [CategoriesController, 'create'])
                  .as('create')
                  .use(middleware.role({ permission: 'categories_admin' }))
                router
                  .post('update', [CategoriesController, 'update'])
                  .as('update')
                  .use(middleware.role({ permission: 'categories_admin' }))
                router
                  .post('delete', [CategoriesController, 'delete'])
                  .as('delete')
                  .use(middleware.role({ permission: 'categories_admin' }))
              })
              .prefix('categories')
              .as('categories')

            router
              .group(() => {
                router
                  .post('search', [DepenseCategoriesController, 'search'])
                  .as('search')
                  .use(middleware.role({ permission: 'depense_categories_admin' }))
                router
                  .post('show', [DepenseCategoriesController, 'show'])
                  .as('show')
                  .use(middleware.role({ permission: 'depense_categories_admin' }))
                router
                  .post('create', [DepenseCategoriesController, 'create'])
                  .as('create')
                  .use(middleware.role({ permission: 'depense_categories_admin' }))
                router
                  .post('update', [DepenseCategoriesController, 'update'])
                  .as('update')
                  .use(middleware.role({ permission: 'depense_categories_admin' }))
                router
                  .post('delete', [DepenseCategoriesController, 'delete'])
                  .as('delete')
                  .use(middleware.role({ permission: 'depense_categories_admin' }))
              })
              .prefix('depense-categories')
              .as('depense_categories')
          })
          .prefix('admin')
          .as('admin')
      })
      .use(middleware.auth())

    // ── Métier (auth + contexte point de vente obligatoire) ────────────────
    router
      .group(() => {
        // Clients
        router
          .group(() => {
            router.post('search', [ClientsController, 'search']).use(middleware.role({ permission: 'clients' }))
            router.post('show', [ClientsController, 'show']).use(middleware.role({ permission: 'clients' }))
            router.post('create', [ClientsController, 'create']).use(middleware.role({ permission: 'clients_write' }))
            router.post('update', [ClientsController, 'update']).use(middleware.role({ permission: 'clients_write' }))
            router.post('deactivate', [ClientsController, 'deactivate']).use(middleware.role({ permission: 'clients_write' }))
            router.post('ventes', [ClientsController, 'ventes']).use(middleware.role({ permission: 'clients' }))
            router.post('solde', [ClientsController, 'solde']).use(middleware.role({ permission: 'clients_solde' }))
          })
          .prefix('clients')
          .as('clients')

        // Fournisseurs
        router
          .group(() => {
            router.post('search', [FournisseursController, 'search']).use(middleware.role({ permission: 'fournisseurs' }))
            router.post('show', [FournisseursController, 'show']).use(middleware.role({ permission: 'fournisseurs' }))
            router.post('create', [FournisseursController, 'create']).use(middleware.role({ permission: 'fournisseurs_write' }))
            router.post('update', [FournisseursController, 'update']).use(middleware.role({ permission: 'fournisseurs_write' }))
            router.post('deactivate', [FournisseursController, 'deactivate']).use(middleware.role({ permission: 'fournisseurs_write' }))
            router.post('achats', [FournisseursController, 'achats']).use(middleware.role({ permission: 'fournisseurs' }))
          })
          .prefix('fournisseurs')
          .as('fournisseurs')

        // Import Excel (migration ERP) — admin uniquement
        router
          .group(() => {
            router
              .post('clients', [ImportsController, 'clients'])
              .as('clients')
              .use(middleware.role({ permission: 'imports' }))
            router
              .post('fournisseurs', [ImportsController, 'fournisseurs'])
              .as('fournisseurs')
              .use(middleware.role({ permission: 'imports' }))
            router
              .post('stock', [ImportsController, 'stock'])
              .as('stock')
              .use(middleware.role({ permission: 'imports' }))
          })
          .prefix('imports')
          .as('imports')

        // Catégories
        router
          .group(() => {
            router.post('search', [CategoriesController, 'search']).use(middleware.role({ permission: 'categories' }))
            router.post('show', [CategoriesController, 'show']).use(middleware.role({ permission: 'categories' }))
            router.post('create', [CategoriesController, 'create']).use(middleware.role({ permission: 'categories_write' }))
            router.post('update', [CategoriesController, 'update']).use(middleware.role({ permission: 'categories_write' }))
            router.post('delete', [CategoriesController, 'delete']).use(middleware.role({ permission: 'categories_write' }))
          })
          .prefix('categories')
          .as('categories')

        // TVA groupes (read-only)
        router
          .get('tva-groupes', [TvaGroupesController, 'index'])
          .as('tva_groupes.index')
          .use(middleware.role({ permission: 'produits' }))
        router
          .post('tva-groupes/show', [TvaGroupesController, 'show'])
          .as('tva_groupes.show')
          .use(middleware.role({ permission: 'produits' }))

        // Produits
        router
          .group(() => {
            router.post('search', [ProduitsController, 'search']).use(middleware.role({ permission: 'produits' }))
            router.post('show', [ProduitsController, 'show']).use(middleware.role({ permission: 'produits' }))
            router.post('create', [ProduitsController, 'create']).use(middleware.role({ permission: 'produits_write' }))
            router.post('update', [ProduitsController, 'update']).use(middleware.role({ permission: 'produits_write' }))
            router.post('deactivate', [ProduitsController, 'deactivate']).use(middleware.role({ permission: 'produits_write' }))
            router.post('alertes', [ProduitsController, 'alertes']).use(middleware.role({ permission: 'produits' }))
            router.post('ajustement', [ProduitsController, 'ajustement']).use(middleware.role({ permission: 'produits_write' }))
            router.post('calcul-prix', [ProduitsController, 'calculPrix']).use(middleware.role({ permission: 'produits' }))
          })
          .prefix('produits')
          .as('produits')

        // Ventes
        router
          .group(() => {
            router.post('search', [VentesController, 'search']).as('search').use(middleware.role({ permission: 'ventes' }))
            router
              .post('get-by-criteria', [VentesController, 'getByCriteria'])
              .as('get_by_criteria')
              .use(middleware.role({ permission: 'ventes' }))
            router.post('show', [VentesController, 'show']).as('show').use(middleware.role({ permission: 'ventes' }))
            router
              .post('ligne-info', [VentesController, 'ligneInfo'])
              .as('ligne_info')
              .use(middleware.role({ permission: 'ventes' }))
            router.post('create', [VentesController, 'create']).as('create').use(middleware.role({ permission: 'ventes_write' }))
            router.post('update', [VentesController, 'update']).as('update').use(middleware.role({ permission: 'ventes_write' }))
            router.post('annuler', [VentesController, 'annuler']).as('annuler').use(middleware.role({ permission: 'ventes_write' }))
            router.post('convertir-facture', [VentesController, 'convertirFacture']).as('convertir_facture').use(middleware.role({ permission: 'ventes_write' }))
            router.post('valider', [VentesController, 'valider']).as('valider').use(middleware.role({ permission: 'ventes_write' }))
            router.post('delete', [VentesController, 'delete']).as('delete').use(middleware.role({ permission: 'ventes_write' }))
            router.post('retour', [VentesController, 'retour']).as('retour').use(middleware.role({ permission: 'ventes_retour' }))
            router.post('paiement', [VentesController, 'paiement']).as('paiement').use(middleware.role({ permission: 'ventes_paiement' }))
            router.post('paiements-search', [VentesController, 'paiementsSearch']).as('paiements_search').use(middleware.role({ permission: 'ventes' }))
            router.post('document', [VentesController, 'document']).as('document').use(middleware.role({ permission: 'ventes' }))
            router.post('imprimer', [VentesController, 'imprimer']).as('imprimer').use(middleware.role({ permission: 'ventes' }))
            router.post('certify', [VentesController, 'certify']).as('certify').use(middleware.role({ permission: 'ventes_certify' }))
            router.post('lock', [VentesController, 'lock']).as('lock').use(middleware.role({ permission: 'ventes_write' }))
            router.post('lock-renew', [VentesController, 'lockRenew']).as('lock_renew').use(middleware.role({ permission: 'ventes_write' }))
            router.post('unlock', [VentesController, 'unlock']).as('unlock').use(middleware.role({ permission: 'ventes_write' }))
          })
          .prefix('ventes')
          .as('ventes')

        // Règlements (client & fournisseur)
        router
          .group(() => {
            router
              .post('client/create', [ReglementsController, 'clientCreate'])
              .as('client.create')
              .use(middleware.role({ permission: 'reglements_write' }))
            router
              .post('client/search', [ReglementsController, 'clientSearch'])
              .as('client.search')
              .use(middleware.role({ permission: 'reglements' }))
            router
              .post('client/show', [ReglementsController, 'clientShow'])
              .as('client.show')
              .use(middleware.role({ permission: 'reglements' }))
            router
              .post('fournisseur/create', [ReglementsController, 'fournisseurCreate'])
              .as('fournisseur.create')
              .use(middleware.role({ permission: 'reglements_write' }))
            router
              .post('fournisseur/search', [ReglementsController, 'fournisseurSearch'])
              .as('fournisseur.search')
              .use(middleware.role({ permission: 'reglements' }))
            router
              .post('fournisseur/show', [ReglementsController, 'fournisseurShow'])
              .as('fournisseur.show')
              .use(middleware.role({ permission: 'reglements' }))
          })
          .prefix('reglements')
          .as('reglements')

        // Achats
        router
          .group(() => {
            router.post('search', [AchatsController, 'search']).as('search').use(middleware.role({ permission: 'achats' }))
            router
              .post('get-by-criteria', [AchatsController, 'getByCriteria'])
              .as('get_by_criteria')
              .use(middleware.role({ permission: 'achats' }))
            router.post('show', [AchatsController, 'show']).as('show').use(middleware.role({ permission: 'achats' }))
            router
              .post('ligne-info', [AchatsController, 'ligneInfo'])
              .as('ligne_info')
              .use(middleware.role({ permission: 'achats' }))
            router.post('create', [AchatsController, 'create']).as('create').use(middleware.role({ permission: 'achats_write' }))
            router.post('update', [AchatsController, 'update']).as('update').use(middleware.role({ permission: 'achats_write' }))
            router.post('annuler', [AchatsController, 'annuler']).as('annuler').use(middleware.role({ permission: 'achats_write' }))
            router.post('recevoir', [AchatsController, 'recevoir']).as('recevoir').use(middleware.role({ permission: 'achats_write' }))
            router.post('retour', [AchatsController, 'retour']).as('retour').use(middleware.role({ permission: 'achats_write' }))
            router.post('paiement', [AchatsController, 'paiement']).as('paiement').use(middleware.role({ permission: 'achats_paiement' }))
          })
          .prefix('achats')
          .as('achats')

        // Caisse
        router
          .get('caisse/solde', [CaisseController, 'solde'])
          .as('caisse.solde')
          .use(middleware.role({ permission: 'caisse' }))
        router
          .post('caisse/mouvements/search', [CaisseController, 'mouvementsSearch'])
          .as('caisse.mouvements.search')
          .use(middleware.role({ permission: 'caisse' }))
        router
          .post('caisse/get-by-criteria', [CaisseController, 'getByCriteria'])
          .as('caisse.get_by_criteria')
          .use(middleware.role({ permission: 'caisse' }))
        router
          .post('caisse/mouvements/show', [CaisseController, 'mouvementsShow'])
          .as('caisse.mouvements.show')
          .use(middleware.role({ permission: 'caisse' }))
        router
          .post('caisse/ouverture', [CaisseController, 'ouverture'])
          .as('caisse.ouverture')
          .use(middleware.role({ permission: 'caisse_write' }))
        router
          .post('caisse/fermeture', [CaisseController, 'fermeture'])
          .as('caisse.fermeture')
          .use(middleware.role({ permission: 'caisse_write' }))
        router
          .post('caisse/entree-manuelle', [CaisseController, 'entreeManuelle'])
          .as('caisse.entree_manuelle')
          .use(middleware.role({ permission: 'caisse_entree' }))
        router
          .post('caisse/session', [CaisseController, 'sessionCourante'])
          .as('caisse.session')
          .use(middleware.role({ permission: 'caisse' }))
        router
          .post('caisse/sessions/search', [CaisseController, 'sessionsSearch'])
          .as('caisse.sessions.search')
          .use(middleware.role({ permission: 'caisse' }))
        router
          .post('caisse/sessions/get-by-criteria', [CaisseController, 'sessionsGetByCriteria'])
          .as('caisse.sessions.get_by_criteria')
          .use(middleware.role({ permission: 'caisse' }))
        router
          .post('caisse/sessions/show', [CaisseController, 'sessionsShow'])
          .as('caisse.sessions.show')
          .use(middleware.role({ permission: 'caisse' }))

        router
          .get('depense-categories', [DepenseCategoriesController, 'index'])
          .as('depense_categories.index')
          .use(middleware.role({ permission: 'depenses' }))

        // Dépenses
        router
          .group(() => {
            router.post('search', [DepensesController, 'search']).as('search').use(middleware.role({ permission: 'depenses' }))
            router.post('show', [DepensesController, 'show']).as('show').use(middleware.role({ permission: 'depenses' }))
            router.post('create', [DepensesController, 'create']).as('create').use(middleware.role({ permission: 'depenses_write' }))
            router.post('update', [DepensesController, 'update']).as('update').use(middleware.role({ permission: 'depenses_admin' }))
            router.post('delete', [DepensesController, 'delete']).as('delete').use(middleware.role({ permission: 'depenses_admin' }))
          })
          .prefix('depenses')
          .as('depenses')

        // Stock
        router.post('stock/search', [StockController, 'search']).as('stock.search').use(middleware.role({ permission: 'stock' }))
        router
          .post('stock/mouvements/search', [StockController, 'mouvementsSearch'])
          .as('stock.mouvements.search')
          .use(middleware.role({ permission: 'stock' }))
        router
          .get('stock/valorisation', [StockController, 'valorisation'])
          .as('stock.valorisation')
          .use(middleware.role({ permission: 'stock' }))
        router.post('stock/alertes', [StockController, 'alertes']).as('stock.alertes').use(middleware.role({ permission: 'stock' }))
        router
          .post('stock/inventaire', [StockController, 'inventaire'])
          .as('stock.inventaire')
          .use(middleware.role({ permission: 'stock_write' }))
        router
          .post('stock/perte', [StockController, 'perte'])
          .as('stock.perte')
          .use(middleware.role({ permission: 'stock_write' }))
        router
          .post('stock/inventaire/grille', [StockController, 'inventaireGrille'])
          .as('stock.inventaire.grille')
          .use(middleware.role({ permission: 'stock_inventaire_saisie' }))
        router
          .post('stock/inventaire/saisie', [StockController, 'inventaireSaisie'])
          .as('stock.inventaire.saisie')
          .use(middleware.role({ permission: 'stock_inventaire_saisie' }))
        router
          .post('stock/inventaire/saisie/search', [StockController, 'inventaireSaisieSearch'])
          .as('stock.inventaire.saisie.search')
          .use(middleware.role({ permission: 'stock_inventaire_saisie' }))
        router
          .post('stock/inventaire/saisie/show', [StockController, 'inventaireSaisieShow'])
          .as('stock.inventaire.saisie.show')
          .use(middleware.role({ permission: 'stock_inventaire_saisie' }))

        // Dépôts
        router
          .group(() => {
            router.post('search', [DepotsController, 'search']).as('search').use(middleware.role({ permission: 'depots' }))
            router.post('show', [DepotsController, 'show']).as('show').use(middleware.role({ permission: 'depots' }))
            router.post('create', [DepotsController, 'create']).as('create').use(middleware.role({ permission: 'depots_write' }))
            router.post('update', [DepotsController, 'update']).as('update').use(middleware.role({ permission: 'depots_write' }))
            router.post('deactivate', [DepotsController, 'deactivate']).as('deactivate').use(middleware.role({ permission: 'depots_write' }))
            router.post('transfert', [DepotsController, 'transfert']).as('transfert').use(middleware.role({ permission: 'depots_transfert' }))
            router.post('stocks', [DepotsController, 'stocks']).as('stocks').use(middleware.role({ permission: 'depots' }))
          })
          .prefix('depots')
          .as('depots')

        // Rapports (tous par critères)
        router
          .group(() => {
            router
              .post('caisse', [RapportsController, 'caisse'])
              .as('caisse')
              .use(middleware.role({ permission: 'rapports' }))
            router
              .post('stock-actuel', [RapportsController, 'stockActuel'])
              .as('stock_actuel')
              .use(middleware.role({ permission: 'rapports' }))
            router
              .post('mouvements-stock', [RapportsController, 'mouvementsStock'])
              .as('mouvements_stock')
              .use(middleware.role({ permission: 'rapports' }))
            router
              .post('marge', [RapportsController, 'marge'])
              .as('marge')
              .use(middleware.role({ permission: 'rapports' }))
            router
              .post('valeur-stock', [RapportsController, 'valeurStock'])
              .as('valeur_stock')
              .use(middleware.role({ permission: 'rapports' }))
            router
              .post('quantite-par-depot', [RapportsController, 'quantiteParDepot'])
              .as('quantite_par_depot')
              .use(middleware.role({ permission: 'rapports' }))
            router
              .post('balance-clients', [RapportsController, 'balanceClients'])
              .as('balance_clients')
              .use(middleware.role({ permission: 'rapports' }))
            router
              .post('releve-client', [RapportsController, 'releveClient'])
              .as('releve_client')
              .use(middleware.role({ permission: 'rapports' }))
            router
              .post('depenses', [RapportsController, 'depenses'])
              .as('depenses')
              .use(middleware.role({ permission: 'rapports' }))
            router
              .post('chiffre-affaires', [RapportsController, 'chiffreAffaire'])
              .as('chiffre_affaires')
              .use(middleware.role({ permission: 'rapports' }))
            router
              .post('balance-fournisseurs', [RapportsController, 'balanceFournisseurs'])
              .as('balance_fournisseurs')
              .use(middleware.role({ permission: 'rapports' }))
            router
              .post('releve-fournisseur', [RapportsController, 'releveFournisseur'])
              .as('releve_fournisseur')
              .use(middleware.role({ permission: 'rapports' }))
            router
              .post('reglement-clients', [RapportsController, 'reglementClients'])
              .as('reglement_clients')
              .use(middleware.role({ permission: 'rapports' }))
            router
              .post('reglement-fournisseurs', [RapportsController, 'reglementFournisseurs'])
              .as('reglement_fournisseurs')
              .use(middleware.role({ permission: 'rapports' }))
            router
              .post('certification', [RapportsController, 'certification'])
              .as('certification')
              .use(middleware.role({ permission: 'rapports_certification' }))
          })
          .prefix('rapports')
          .as('rapports')
      })
      .use(middleware.auth())
      .use(middleware.pointDeVente())
  })
  .prefix('/api/v1')
