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
  {
    key: 'documents_date_libre',
    label: 'Modifier la date des documents (devis, ventes, achats, paiements, dépenses)',
    group: 'Général',
  },
  { key: 'clients', label: 'Clients (consultation)', group: 'Clients' },
  { key: 'clients_write', label: 'Modifier client', group: 'Clients' },
  { key: 'clients_solde', label: 'Solde client', group: 'Clients' },
  { key: 'fournisseurs', label: 'Fournisseurs (consultation)', group: 'Fournisseurs' },
  { key: 'fournisseurs_write', label: 'Modifier fournisseur', group: 'Fournisseurs' },
  { key: 'fournisseurs_solde', label: 'Solde fournisseur', group: 'Fournisseurs' },
  { key: 'produits', label: 'Produits (consultation)', group: 'Produits' },
  { key: 'produits_write', label: 'Modifier produit', group: 'Produits' },
  { key: 'produits_cmup_plancher', label: 'Voir CMUP et plancher (catalogue)', group: 'Produits' },
  { key: 'produits_plancher', label: 'Modifier CMUP et frais catalogue manuellement', group: 'Produits' },
  { key: 'ventes', label: 'Ventes (consultation)', group: 'Ventes' },
  { key: 'ventes_write', label: 'Créer / modifier vente', group: 'Ventes' },
  { key: 'ventes_ligne_marge', label: 'Marge ligne vente', group: 'Ventes' },
  { key: 'ventes_marge_pct', label: 'Marge % facture', group: 'Ventes' },
  { key: 'ventes_ligne_plancher', label: 'Plancher ligne vente', group: 'Ventes' },
  { key: 'ventes_ligne_remise', label: 'Remise % ligne facture', group: 'Ventes' },
  { key: 'ventes_remise_totale', label: 'Remise % totale facture', group: 'Ventes' },
  { key: 'ventes_remise_montant', label: 'Remise montant facture', group: 'Ventes' },
  { key: 'ventes_paiement', label: 'Paiement vente', group: 'Ventes' },
  { key: 'ventes_retour', label: 'Facture retour', group: 'Ventes' },
  { key: 'ventes_certify', label: 'Certifier facture FNE', group: 'Ventes' },
  { key: 'fne_admin', label: 'Configuration FNE (cles API)', group: 'Administration' },
  { key: 'achats', label: 'Achats (consultation)', group: 'Achats' },
  { key: 'achats_write', label: 'Créer / modifier achat', group: 'Achats' },
  { key: 'achats_paiement', label: 'Paiement achat', group: 'Achats' },
  { key: 'stock', label: 'Stock (consultation)', group: 'Stock' },
  { key: 'stock_write', label: 'Stock (modification)', group: 'Stock' },
  { key: 'stock_inventaire_saisie', label: 'Saisie inventaire stock', group: 'Stock' },
  { key: 'depots', label: 'Dépôts (consultation)', group: 'Stock' },
  { key: 'depots_write', label: 'Créer / modifier dépôt', group: 'Stock' },
  { key: 'depots_transfert', label: 'Transfert entre dépôts', group: 'Stock' },
  { key: 'categories', label: 'Catégories (consultation)', group: 'Produits' },
  { key: 'categories_write', label: 'Modifier catégories', group: 'Produits' },
  { key: 'caisse', label: 'Caisse (consultation)', group: 'Caisse' },
  { key: 'caisse_write', label: 'Caisse (opérations)', group: 'Caisse' },
  { key: 'caisse_entree', label: 'Entrée caisse manuelle', group: 'Caisse' },
  { key: 'reglements', label: 'Règlements (consultation)', group: 'Caisse' },
  { key: 'reglements_write', label: 'Saisir règlement', group: 'Caisse' },
  { key: 'rapports', label: 'Rapports', group: 'Rapports' },
  { key: 'rapports_certification', label: 'Rapport certification FNE', group: 'Rapports' },
  { key: 'depenses', label: 'Dépenses (consultation)', group: 'Dépenses' },
  { key: 'depenses_write', label: 'Saisir dépense', group: 'Dépenses' },
  { key: 'depenses_admin', label: 'Administrer dépenses', group: 'Dépenses' },
  { key: 'users', label: 'Utilisateurs', group: 'Administration' },
  { key: 'points_de_vente', label: 'Points de vente', group: 'Administration' },
  { key: 'tva_admin', label: 'Gérer les groupes TVA', group: 'Administration' },
  { key: 'categories_admin', label: 'Gérer les catégories produits', group: 'Administration' },
  { key: 'depense_categories_admin', label: 'Gérer les catégories de dépenses', group: 'Administration' },
  { key: 'imports', label: 'Import Excel (clients, fournisseurs, articles)', group: 'Administration' },
]

/**
 * Default permissions per role (aligned with production user templates):
 * - admin: all (handled in permission_service)
 * - gerant: gerant1@gestion.com template
 * - caissier: caissier1@gestion.com template
 * - facturation: facturation1@gestion.com template
 */
export const ROLE_PERMISSIONS = {
  points_de_vente: ['admin'],
  users: ['admin'],
  dashboard: ['admin', 'gerant'],
  documents_date_libre: ['admin'],
  clients: ['admin', 'gerant', 'caissier', 'facturation'],
  clients_write: ['admin', 'gerant'],
  clients_solde: ['admin', 'gerant', 'caissier'],
  fournisseurs: ['admin', 'gerant', 'caissier', 'facturation'],
  fournisseurs_write: ['admin', 'gerant'],
  fournisseurs_solde: ['admin', 'gerant'],
  categories: ['admin', 'gerant', 'facturation'],
  categories_write: ['admin'],
  produits: ['admin', 'gerant', 'facturation'],
  produits_write: ['admin'],
  produits_cmup_plancher: ['admin', 'gerant'],
  produits_plancher: ['admin', 'gerant'],
  caisse_entree: ['admin', 'gerant', 'caissier'],
  ventes: ['admin', 'gerant', 'caissier', 'facturation'],
  ventes_write: ['admin', 'gerant', 'facturation'],
  ventes_ligne_marge: ['admin', 'gerant'],
  ventes_marge_pct: ['admin', 'gerant'],
  ventes_ligne_plancher: ['admin', 'gerant'],
  ventes_ligne_remise: ['admin', 'gerant'],
  ventes_remise_totale: ['admin', 'gerant'],
  ventes_remise_montant: ['admin', 'gerant'],
  ventes_paiement: ['admin', 'gerant', 'caissier'],
  ventes_retour: ['admin', 'gerant', 'facturation'],
  ventes_certify: ['admin', 'gerant', 'facturation'],
  fne_admin: ['admin'],
  achats: ['admin', 'gerant', 'facturation'],
  achats_write: ['admin', 'gerant'],
  achats_paiement: ['admin', 'gerant', 'facturation'],
  caisse: ['admin', 'gerant', 'caissier'],
  caisse_write: ['admin', 'gerant', 'caissier'],
  reglements: ['admin', 'gerant', 'caissier'],
  reglements_write: ['admin', 'gerant', 'caissier'],
  depenses: ['admin', 'gerant', 'caissier'],
  depenses_write: ['admin', 'gerant', 'caissier'],
  depenses_admin: ['admin'],
  stock: ['admin', 'gerant', 'facturation'],
  stock_write: ['admin', 'gerant'],
  stock_inventaire_saisie: ['admin'],
  depots: ['admin', 'gerant', 'facturation'],
  depots_write: ['admin'],
  depots_transfert: ['admin', 'gerant'],
  rapports: ['admin', 'gerant'],
  rapports_certification: ['admin', 'gerant'],
  tva_admin: ['admin'],
  categories_admin: ['admin'],
  depense_categories_admin: ['admin'],
  imports: ['admin'],
} as const satisfies Record<string, UserRole[]>

export type PermissionKey = keyof typeof ROLE_PERMISSIONS

/** Not assignable via user permissions UI — effective only for roles listed in ROLE_PERMISSIONS. */
export const ROLE_LOCKED_PERMISSION_KEYS: PermissionKey[] = ['dashboard']

export const ALL_PERMISSION_KEYS = Object.keys(ROLE_PERMISSIONS) as PermissionKey[]
