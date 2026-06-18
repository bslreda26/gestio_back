import type { UserRole } from '#validators/common_validator'

export type PermissionDefinition = {
  key: PermissionKey
  label: string
  group: string
}

/**
 * Permissions assignables per user from the admin UI.
 * Admin role always has every key below.
 */
export const PERMISSION_CATALOG: PermissionDefinition[] = [
  { key: 'dashboard', label: 'Tableau de bord', group: 'Général' },
  { key: 'clients', label: 'Clients (consultation)', group: 'Clients' },
  { key: 'clients_write', label: 'Modifier client', group: 'Clients' },
  { key: 'clients_solde', label: 'Solde client', group: 'Clients' },
  { key: 'fournisseurs', label: 'Fournisseurs (consultation)', group: 'Fournisseurs' },
  { key: 'fournisseurs_write', label: 'Modifier fournisseur', group: 'Fournisseurs' },
  { key: 'fournisseurs_solde', label: 'Solde fournisseur', group: 'Fournisseurs' },
  { key: 'produits', label: 'Produits (consultation)', group: 'Produits' },
  { key: 'produits_write', label: 'Modifier produit', group: 'Produits' },
  { key: 'produits_plancher', label: 'Plancher & prix achat produit', group: 'Produits' },
  { key: 'ventes', label: 'Ventes (consultation)', group: 'Ventes' },
  { key: 'ventes_write', label: 'Créer / modifier vente', group: 'Ventes' },
  { key: 'ventes_ligne_marge', label: 'Marge ligne vente', group: 'Ventes' },
  { key: 'ventes_marge_pct', label: 'Marge % facture', group: 'Ventes' },
  { key: 'ventes_ligne_plancher', label: 'Plancher ligne vente', group: 'Ventes' },
  { key: 'ventes_paiement', label: 'Paiement vente', group: 'Ventes' },
  { key: 'ventes_retour', label: 'Facture retour', group: 'Ventes' },
  { key: 'ventes_certify', label: 'Certifier facture FNE', group: 'Ventes' },
  { key: 'fne_admin', label: 'Configuration FNE (cles API)', group: 'Administration' },
  { key: 'achats', label: 'Achats (consultation)', group: 'Achats' },
  { key: 'achats_write', label: 'Créer / modifier achat', group: 'Achats' },
  { key: 'achats_paiement', label: 'Paiement achat', group: 'Achats' },
  { key: 'stock', label: 'Stock (consultation)', group: 'Stock' },
  { key: 'stock_write', label: 'Stock (modification)', group: 'Stock' },
  { key: 'depots', label: 'Dépôts (consultation)', group: 'Stock' },
  { key: 'depots_write', label: 'Créer / modifier dépôt', group: 'Stock' },
  { key: 'depots_transfert', label: 'Transfert entre dépôts', group: 'Stock' },
  { key: 'categories', label: 'Catégories (consultation)', group: 'Produits' },
  { key: 'categories_write', label: 'Modifier catégories', group: 'Produits' },
  { key: 'caisse', label: 'Caisse (consultation)', group: 'Caisse' },
  { key: 'caisse_write', label: 'Caisse (opérations)', group: 'Caisse' },
  { key: 'reglements', label: 'Règlements (consultation)', group: 'Caisse' },
  { key: 'reglements_write', label: 'Saisir règlement', group: 'Caisse' },
  { key: 'rapports', label: 'Rapports', group: 'Rapports' },
  { key: 'depenses', label: 'Dépenses (consultation)', group: 'Dépenses' },
  { key: 'depenses_write', label: 'Saisir dépense', group: 'Dépenses' },
  { key: 'depenses_admin', label: 'Administrer dépenses', group: 'Dépenses' },
  { key: 'users', label: 'Utilisateurs', group: 'Administration' },
  { key: 'points_de_vente', label: 'Points de vente', group: 'Administration' },
  { key: 'tva_admin', label: 'Gérer les groupes TVA', group: 'Administration' },
  { key: 'categories_admin', label: 'Gérer les catégories produits', group: 'Administration' },
  { key: 'depense_categories_admin', label: 'Gérer les catégories de dépenses', group: 'Administration' },
]

/**
 * Default permissions per role:
 * - admin: all (handled in permission_service)
 * - gerant: operational manager (catalog, stock, purchases, margins)
 * - caissier: point of sale and cash register
 * - facturation: invoicing, client balances, supplier payments
 */
export const ROLE_PERMISSIONS = {
  points_de_vente: ['admin'],
  users: ['admin'],
  dashboard: ['admin', 'gerant', 'caissier', 'facturation'],
  clients: ['admin', 'gerant', 'caissier', 'facturation'],
  clients_write: ['admin', 'gerant', 'facturation'],
  clients_solde: ['admin', 'gerant', 'facturation'],
  fournisseurs: ['admin', 'gerant', 'facturation'],
  fournisseurs_write: ['admin', 'gerant'],
  fournisseurs_solde: ['admin', 'gerant', 'facturation'],
  categories: ['admin', 'gerant', 'caissier', 'facturation'],
  categories_write: ['admin', 'gerant'],
  produits: ['admin', 'gerant', 'caissier', 'facturation'],
  produits_write: ['admin', 'gerant'],
  produits_plancher: ['admin'],
  ventes: ['admin', 'gerant', 'caissier', 'facturation'],
  ventes_write: ['admin', 'gerant', 'caissier', 'facturation'],
  ventes_ligne_marge: ['admin', 'gerant'],
  ventes_marge_pct: ['admin', 'gerant'],
  ventes_ligne_plancher: ['admin', 'gerant'],
  ventes_paiement: ['admin', 'gerant', 'caissier', 'facturation'],
  ventes_retour: ['admin', 'gerant'],
  ventes_certify: ['admin', 'gerant', 'facturation'],
  fne_admin: ['admin'],
  achats: ['admin', 'gerant', 'facturation'],
  achats_write: ['admin', 'gerant'],
  achats_paiement: ['admin', 'gerant', 'facturation'],
  caisse: ['admin', 'gerant', 'caissier'],
  caisse_write: ['admin', 'gerant', 'caissier'],
  reglements: ['admin', 'gerant', 'caissier', 'facturation'],
  reglements_write: ['admin', 'gerant', 'caissier', 'facturation'],
  depenses: ['admin', 'gerant', 'caissier'],
  depenses_write: ['admin', 'gerant', 'caissier'],
  depenses_admin: ['admin'],
  stock: ['admin', 'gerant'],
  stock_write: ['admin', 'gerant'],
  depots: ['admin', 'gerant'],
  depots_write: ['admin', 'gerant'],
  depots_transfert: ['admin', 'gerant'],
  rapports: ['admin', 'gerant', 'facturation'],
  tva_admin: ['admin'],
  categories_admin: ['admin'],
  depense_categories_admin: ['admin'],
} as const satisfies Record<string, UserRole[]>

export type PermissionKey = keyof typeof ROLE_PERMISSIONS

export const ALL_PERMISSION_KEYS = Object.keys(ROLE_PERMISSIONS) as PermissionKey[]
