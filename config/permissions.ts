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
  { key: 'produits_plancher', label: 'Plancher produit', group: 'Produits' },
  { key: 'ventes', label: 'Ventes (consultation)', group: 'Ventes' },
  { key: 'ventes_write', label: 'Créer / modifier vente', group: 'Ventes' },
  { key: 'ventes_ligne_marge', label: 'Marge ligne vente', group: 'Ventes' },
  { key: 'ventes_ligne_plancher', label: 'Plancher ligne vente', group: 'Ventes' },
  { key: 'ventes_paiement', label: 'Paiement vente', group: 'Ventes' },
  { key: 'ventes_retour', label: 'Facture retour', group: 'Ventes' },
  { key: 'achats', label: 'Achats (consultation)', group: 'Achats' },
  { key: 'achats_write', label: 'Créer / modifier achat', group: 'Achats' },
  { key: 'achats_paiement', label: 'Paiement achat', group: 'Achats' },
  { key: 'stock', label: 'Stock (consultation)', group: 'Stock' },
  { key: 'stock_write', label: 'Stock (modification)', group: 'Stock' },
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

export const ROLE_PERMISSIONS = {
  points_de_vente: ['admin'],
  users: ['admin'],
  dashboard: ['admin', 'gestionnaire', 'caissier', 'lecteur'],
  clients: ['admin', 'gestionnaire', 'caissier', 'lecteur'],
  clients_write: ['admin', 'gestionnaire'],
  clients_solde: ['admin', 'gestionnaire', 'lecteur'],
  fournisseurs: ['admin', 'gestionnaire', 'lecteur'],
  fournisseurs_write: ['admin', 'gestionnaire'],
  fournisseurs_solde: ['admin', 'gestionnaire', 'lecteur'],
  categories: ['admin', 'gestionnaire', 'lecteur'],
  categories_write: ['admin', 'gestionnaire'],
  produits: ['admin', 'gestionnaire', 'lecteur'],
  produits_write: ['admin', 'gestionnaire'],
  produits_plancher: ['admin'],
  ventes: ['admin', 'gestionnaire', 'caissier', 'lecteur'],
  ventes_write: ['admin', 'gestionnaire', 'caissier'],
  ventes_ligne_marge: ['admin', 'gestionnaire'],
  ventes_ligne_plancher: ['admin', 'gestionnaire'],
  ventes_paiement: ['admin', 'gestionnaire', 'caissier'],
  ventes_retour: ['admin'],
  achats: ['admin', 'gestionnaire', 'lecteur'],
  achats_write: ['admin', 'gestionnaire'],
  achats_paiement: ['admin', 'gestionnaire'],
  caisse: ['admin', 'gestionnaire', 'caissier', 'lecteur'],
  caisse_write: ['admin', 'gestionnaire', 'caissier'],
  reglements: ['admin', 'gestionnaire', 'caissier', 'lecteur'],
  reglements_write: ['admin', 'gestionnaire', 'caissier'],
  depenses: ['admin', 'gestionnaire', 'caissier', 'lecteur'],
  depenses_write: ['admin', 'gestionnaire', 'caissier'],
  depenses_admin: ['admin'],
  stock: ['admin', 'gestionnaire', 'lecteur'],
  stock_write: ['admin', 'gestionnaire'],
  rapports: ['admin', 'gestionnaire', 'lecteur'],
  tva_admin: ['admin'],
  categories_admin: ['admin'],
  depense_categories_admin: ['admin'],
} as const satisfies Record<string, UserRole[]>

export type PermissionKey = keyof typeof ROLE_PERMISSIONS

export const ALL_PERMISSION_KEYS = Object.keys(ROLE_PERMISSIONS) as PermissionKey[]
