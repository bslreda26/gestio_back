# Gestion Commerciale — API Reference

Base URL: `/api/v1`  
Health: `GET /health`

Convention: **GET** and **POST** only (no PUT/PATCH/DELETE).

Source of truth: `start/routes.ts`

---

## Authentication & headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Protected routes | `Bearer <token>` from login |
| `Content-Type` | POST bodies | `application/json` |
| `X-Point-De-Vente-Id` | Business routes* | Point de vente ID (integer) |

\* Required on the **business** group (clients, produits, ventes, achats, stock, caisse, etc.).  
**Not** required for `/auth/*`, `/points-de-vente/*`, `/users/*`, `/admin/*`.

**Admin users** must send `X-Point-De-Vente-Id` on every business call.  
**Other roles** are scoped to `users.point_de_vente_id`; a different header returns **403**.

### Multi point de vente

| Scope | Modules |
|-------|---------|
| Per PDV | `clients`, `produits`, `categories`, `ventes`, `achats`, `caisses`, `depenses`, `reglements` |
| Shared | `fournisseurs` |
| No PDV header | `auth`, `points-de-vente`, `users`, `admin/*` |

- Document numbers: `{code_pdv}-DEV|FAC|RET|ACH|AVR-{année}-{seq}` (ex. `01-FAC-2026-0001`)
- Creating a PDV auto-creates its default **caisse**
- `GET /auth/me` returns `role`, `permissions`, `point_de_vente_id`, `points_de_vente[]`

---

## Response format

### Success

```json
{ "data": { } }
```

### Paginated

```json
{
  "data": [ ],
  "meta": { "total": 42, "page": 1, "limit": 20, "lastPage": 3 }
}
```

### Error

```json
{
  "message": "Description en français",
  "errors": { "field": ["message"] }
}
```

| Status | Usage |
|--------|--------|
| 200 | Success |
| 400 | Bad request / PDV manquant |
| 401 | Non authentifié |
| 403 | Accès refusé |
| 404 | Ressource introuvable |
| 409 | Conflit (ex. verrou vente) |
| 422 | Règle métier / validation |
| 429 | Rate limit login |

Pagination: `page` default 1, `limit` default 20 (max 100).

---

## Roles & permissions

### Roles (`users.role`)

| Role | Description |
|------|-------------|
| `admin` | Toutes les permissions |
| `gerant` | Gestion opérationnelle (catalogue, stock, achats, marges) |
| `caissier` | Point de vente et caisse |
| `facturation` | Facturation, soldes clients/fournisseurs |

### Permissions

Chaque route métier vérifie une **permission** (ex. `ventes_write`).  
Les permissions effectives = rôle + éventuelles permissions personnalisées (`users.permissions` JSON).

`POST /auth/login` et `GET /auth/me` retournent `permissions: string[]`.

Admin — gestion des droits utilisateur :

| Method | Path |
|--------|------|
| POST | `/api/v1/users/permissions-catalog` |
| POST | `/api/v1/users/permissions/show` `{ "id": 1 }` |
| POST | `/api/v1/users/permissions/update` `{ "id": 1, "permissions": ["ventes", "ventes_write"] }` |

Catalogue complet : `config/permissions.ts` (`PERMISSION_CATALOG`).

Permissions notables :

| Permission | Usage |
|------------|--------|
| `produits_plancher` | Modifier plancher, moyenne achat, dernier prix achat |
| `ventes_ligne_marge` | Voir la marge unitaire sur les lignes vente |
| `ventes_marge_pct` | Voir la **marge %** sur la facture / devis (PDF inclus) |
| `ventes_ligne_plancher` | Voir le plancher sur les lignes vente |
| `ventes_retour` | Créer un avoir client |
| `ventes_certify` | Certifier une facture ou un avoir auprès de la FNE |
| `fne_admin` | Configurer la clé API FNE (`/fne-config/*`) |
| `achats_paiement` | Payer un achat (séparé de `achats_write`) |
| `clients_solde` | Consulter le solde client (fiche, liste, relevé) |
| `fournisseurs_solde` | Consulter le solde fournisseur (fiche, liste) |
| `tva_admin` | CRUD groupes TVA (`/admin/tva-groupes`) |
| `categories_admin` | CRUD catégories admin (`/admin/categories`) |
| `depense_categories_admin` | CRUD catégories dépenses (`/admin/depense-categories`) |

---

## Unités produit & stock (important frontend)

### Configuration produit

| Champ | Description |
|-------|-------------|
| `unite` | Unité **détail** (kg, litre…) — stock interne |
| `uniteGros` | Unité **gros** (SAC, carton, pièce…) |
| `contenance` | Nombre d'unités détail dans 1 unité gros (ex. 50 kg/sac) |
| `venteAuDetail` | Autorise vente/ajustement au détail |

Règle : `unite` + `uniteGros` + `contenance > 1` → produit **gros + détail**. Sinon produit **gros simple** (1:1).

**Configurer les unités avant tout achat/réception** sur un produit gros+détail.

### Stock interne

`produits.stock_actuel` est toujours en **unité détail** (kg pour le riz 50 kg/sac).

| Opération | Conversion |
|-----------|------------|
| Achat en gros (`mode_achat: piece`) | `quantite_stock = quantite × contenance` |
| Vente en gros (`mode_vente: piece`) | idem |
| Vente/achat au détail (`detail`) | `quantite_stock = quantite` |

### Champs affichage stock (réponse `produits/*`, `stock/*`)

| Champ | Description |
|-------|-------------|
| `stockActuel` | Stock interne (unité détail) |
| `stockDetail` | Alias numérique |
| `stockPieces` | Nombre de pièces/sacs entiers |
| `stockResteDetail` | Reliquat en unité détail |
| `stockLabel` | **Libellé à afficher** (ex. `35 SAC`, `55 SAC + 35 kg`) |
| `stockStatus` | `rupture` \| `alerte` \| `normal` \| `surstock` |

**Ne pas** afficher `stockActuel` + `unite` — utiliser **`stockLabel`**.

### Ajustement manuel

`POST /produits/ajustement` accepte :

```json
{
  "id": 3,
  "type": "entree",
  "quantite_pieces": 5,
  "quantite_detail": 10,
  "notes": "Inventaire"
}
```

Ou legacy : `{ "quantite": 260 }` (unité détail).

---

## Health

`GET /health` → `{ "status": "ok" }`

---

## Auth

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/login` | Public |
| POST | `/auth/logout` | Oui |
| GET | `/auth/me` | Oui |
| POST | `/auth/change-password` | Oui |

**Login** — rate limit : 10 échecs/min/IP + 5/min/IP+email (bloc 20 min).

```json
// POST /auth/login
{ "email": "admin@gestion.com", "password": "Admin@123456" }

// Response
{
  "data": {
    "user": { "id": 1, "fullName": "...", "email": "...", "role": "admin", "permissions": ["..."] },
    "token": "oat_..."
  }
}
```

```json
// GET /auth/me
{
  "data": {
    "id": 1,
    "fullName": "Admin Gestion",
    "email": "admin@gestion.com",
    "role": "admin",
    "permissions": ["dashboard", "clients", "..."],
    "point_de_vente_id": null,
    "points_de_vente": [{ "id": 1, "code": "01", "nom": "..." }]
  }
}
```

---

## Points de vente

Permission: `points_de_vente`. Pas de header PDV.

| Method | Path |
|--------|------|
| POST | `/points-de-vente/search` |
| POST | `/points-de-vente/show` |
| POST | `/points-de-vente/create` |
| POST | `/points-de-vente/update` |
| POST | `/points-de-vente/deactivate` |

### Champs FNE (certification)

| Champ | Description |
|-------|-------------|
| `point_of_sale` | Nom PDV envoyé à la FNE (`pointOfSale`) |
| `establishment` | Nom établissement envoyé à la FNE |
| `timbre_reference` | Code produit timbre (ligne exclue du payload ; force `paymentMethod: cash`) |

Préremplis à `nom` par migration si non renseignés. À configurer via `POST /points-de-vente/update`.

```json
{
  "id": 1,
  "point_of_sale": "magasin-centre",
  "establishment": "GESTIO SARL",
  "timbre_reference": "TIMBRE-FNE"
}
```

---

## Configuration FNE (admin)

Permission: `fne_admin`. Pas de header PDV.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/fne-config/show` | Lire la config active (clé masquée) |
| POST | `/fne-config/upsert` | Enregistrer clé + URL production |

```json
// POST /fne-config/upsert
{
  "key": "votre-cle-api-fne",
  "prod_url": "https://url-api-fne-production",
  "is_active": true
}

// Response
{
  "data": {
    "message": "Configuration FNE enregistree",
    "apikey": {
      "id": 1,
      "key_preview": "abcd...wxyz",
      "prod_url": "https://...",
      "is_active": true
    }
  }
}
```

Une seule clé active à la fois (`upsert` désactive les précédentes).

---

## Users

Permission: `users`. Pas de header PDV.

| Method | Path |
|--------|------|
| POST | `/users/search` |
| POST | `/users/show` |
| POST | `/users/create` |
| POST | `/users/update` |
| POST | `/users/deactivate` |
| POST | `/users/permissions-catalog` |
| POST | `/users/permissions/show` |
| POST | `/users/permissions/update` |

**Create**

```json
{
  "nom": "Dupont",
  "prenom": "Marie",
  "email": "gerant@gestion.com",
  "password": "Gerant@123456",
  "role": "gerant",
  "point_de_vente_id": 1
}
```

`role`: `admin` \| `gerant` \| `caissier` \| `facturation`  
`point_de_vente_id` obligatoire pour les rôles non-admin.

---

## Admin (référentiels globaux)

Auth requis. Pas de header PDV.

### TVA groupes — `/admin/tva-groupes/*`

Permission: `tva_admin`

| Method | Path |
|--------|------|
| POST | `/admin/tva-groupes/search` |
| POST | `/admin/tva-groupes/show` |
| POST | `/admin/tva-groupes/create` |
| POST | `/admin/tva-groupes/update` |
| POST | `/admin/tva-groupes/deactivate` |

### Catégories produits (admin) — `/admin/categories/*`

Permission: `categories_admin` — CRUD sans scope PDV (gestion centralisée).

### Catégories dépenses — `/admin/depense-categories/*`

Permission: `depense_categories_admin`

---

## Clients

Auth + `X-Point-De-Vente-Id`.

| Method | Path | Permission |
|--------|------|------------|
| POST | `/clients/search` | `clients` |
| POST | `/clients/show` | `clients` |
| POST | `/clients/create` | `clients_write` |
| POST | `/clients/update` | `clients_write` |
| POST | `/clients/deactivate` | `clients_write` |
| POST | `/clients/ventes` | `clients` |
| POST | `/clients/solde` | `clients_solde` |

`type`: `B2B` \| `B2C` \| `B2F` \| `B2G` (défaut `B2C`)

| Champ | Description |
|-------|-------------|
| `ncc` | Numéro de Compte Contribuable — **obligatoire pour certification FNE B2B** |

```json
// POST /clients/create
{
  "nom": "Société ABC",
  "type": "B2B",
  "ncc": "9606123E",
  "email": "client@ex.com",
  "telephone": "+2250700000001"
}
```

### Solde client (compte)

Le champ `solde` renvoyé par **`/clients/search`**, **`/clients/show`** et **`/clients/solde`** est **recalculé** depuis les mouvements du point de vente courant (même logique que le relevé), et non lu depuis la valeur stockée en base.

**Formule (PDV courant)** :

```
solde = Σ factures validées TTC
      + Σ factures non validées TTC
      − Σ avoirs client TTC
      − Σ paiements vente
      − Σ règlements client (crédit)
      + Σ règlements client (débit, montant négatif)
```

- Permission `clients_solde` requise pour voir `solde` (sinon champ omis).
- `POST /clients/solde` retourne aussi `totalCreances` (somme des `reste_a_payer` sur factures ouvertes) et les derniers paiements.

---

## Fournisseurs

Partagés entre PDV. Auth + header PDV.

| Method | Path | Permission |
|--------|------|------------|
| POST | `/fournisseurs/search` | `fournisseurs` |
| POST | `/fournisseurs/show` | `fournisseurs` |
| POST | `/fournisseurs/create` | `fournisseurs_write` |
| POST | `/fournisseurs/update` | `fournisseurs_write` |
| POST | `/fournisseurs/deactivate` | `fournisseurs_write` |
| POST | `/fournisseurs/achats` | `fournisseurs` |

### Solde fournisseur (compte)

Le champ `solde` renvoyé par **`/fournisseurs/search`** et **`/fournisseurs/show`** est **recalculé** pour le **point de vente courant** (aligné sur le relevé fournisseur), et non la valeur globale `fournisseurs.solde` en base.

**Formule (PDV courant)** :

```
solde = Σ réceptions achat TTC (lignes reçues)
      − Σ retours fournisseur TTC
      − Σ paiements achat
      − Σ règlements fournisseur (crédit)
      + Σ règlements fournisseur (débit, montant négatif)
```

- Permission `fournisseurs_solde` requise pour voir `solde` (sinon champ omis).
- Solde **positif** = dette envers le fournisseur ; solde **négatif** = trop-perçu / avance fournisseur.
- Le relevé détaillé : `POST /rapports/releve-fournisseur`.

---

## Catégories (métier)

Scope PDV. Permissions `categories` / `categories_write`.

| Method | Path |
|--------|------|
| POST | `/categories/search` |
| POST | `/categories/show` |
| POST | `/categories/create` |
| POST | `/categories/update` |
| POST | `/categories/delete` |

---

## TVA groupes (lecture métier)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/tva-groupes` | `produits` |
| POST | `/tva-groupes/show` | `produits` |

### Codes FNE (mapping automatique par taux)

Le backend mappe le taux TVA produit → code FNE à la certification :

| Taux | Code FNE | Référence seed |
|------|----------|----------------|
| 18 % | `TVA` | `TVA18` |
| 9 % | `TVAB` | `TVA9` |
| 0 % | `TVAC` | `TVA0` |

Seuls ces 3 taux sont acceptés pour la certification. Assigner le bon `tva_groupe_id` sur chaque produit.

---

## Produits

| Method | Path | Permission |
|--------|------|------------|
| POST | `/produits/search` | `produits` |
| POST | `/produits/show` | `produits` |
| POST | `/produits/create` | `produits_write` |
| POST | `/produits/update` | `produits_write` |
| POST | `/produits/deactivate` | `produits_write` |
| POST | `/produits/alertes` | `produits` |
| POST | `/produits/ajustement` | `produits_write` |
| POST | `/produits/calcul-prix` | `produits` |

### Create / update

```json
{
  "nom": "RIZ SAVANNAH 50 KG",
  "code": "RIZ50",
  "categorie_id": 1,
  "tva_groupe_id": 1,
  "unite": "kg",
  "unite_gros": "SAC",
  "contenance": 50,
  "vente_au_detail": true,
  "prix_vente_ttc": 25000,
  "frais": 50,
  "airsi_pct": 5,
  "stock_minimum": 0
}
```

| Champ | Description |
|-------|-------------|
| `airsi_pct` | Taux AIRSI (%) appliqué sur chaque vente de ce produit (0–100, défaut `0`) |

Champs prix optionnels à la création. Stock initial = 0 (ajustement ou achat).

### Prix produit (réponse sérialisée)

| Champ | Description |
|-------|-------------|
| `prixAchatHt` | Moyenne achat HT **hors frais** (stockage interne ; en **gros** à l'affichage catalogue) |
| `moyenneAchatHt` | **CMUP HT** affiché = `prixAchatHt` + **frais HT** (unité gros) |
| `frais` | Frais catalogue **TTC** par unité gros (ex. 50) |
| `dernierPrixAchatHt` | Dernier prix en **unité gros** (sac…) |
| `prixVenteTtc` | Prix vente TTC catalogue (par gros) |
| `plancher` | **CMUP TTC** = CMUP HT + TVA (recalculé à la réception) |
| `airsiPct` | Taux AIRSI (%) du produit — copié sur chaque ligne de vente |

**Formules** (service `pricing_service`) :

- `frais HT` = `frais TTC × (1 − taux_tva / 100)` — ex. frais 50, TVA 9 % → frais HT **45,5**
- `CMUP HT` = moyenne achat HT + frais HT — ex. 20 000 + 45,5 = **20 045,5**
- `plancher` = CMUP HT × (1 + taux_tva / 100) — ex. CMUP 20 000, TVA 9 % → **21 800**

`POST /produits/calcul-prix` retourne aussi `moyenne_achat_ht` (CMUP HT calculé).

Mise à jour plancher / moyenne / dernier prix : permission `produits_plancher`.  
La saisie `moyenne_achat_ht` en update enregistre la **moyenne achat HT hors frais** ; l'affichage `moyenneAchatHt` inclut les frais.

À la réception achat : CMUP pondéré séparément sur `prixAchatHt` et `frais` (TTC), puis recalcul `plancher`.

### Conversion stock & prix à la mise à jour unités

| Transition | Stock | Prix stockage |
|------------|-------|---------------|
| Gros simple → gros+détail | `stock × contenance` | prix/frais/plancher → unité détail |
| Gros+détail → gros simple (contenance retirée / 0) | `stock ÷ ancienne contenance` | prix/frais/plancher → unité gros |

Ex. 39 sac + 30 kg (stock interne 1980 kg, contenance 50) → retrait contenance → **39,6 sac** affiché (pas 1980 sac).

---

## Ventes

Numéros : `{pdv}-DEV-{année}-{seq}` (devis), `{pdv}-FAC-{année}-{seq}` (facture), `{pdv}-RET-{année}-{seq}` (avoir).

### Statuts

| Statut | Label | Stock | Solde client |
|--------|-------|-------|--------------|
| `devis` | Devis | Non | Non |
| `non_valide` | Facture non validée | Oui (sortie) | Oui |
| `valide` | Facture validée | Déjà déduit | Oui |
| `retour` | Avoir client | Entrée (retour) | Ajusté |

### Workflow

```
devis ──convertir-facture──► non_valide ──valider──► valide
  │                              │
  annuler                        delete (si non payée) → retour stock
```

Création directe facture : `POST /ventes/create` avec `"statut": "non_valide"`.

| Method | Path | Permission |
|--------|------|------------|
| POST | `/ventes/search` | `ventes` |
| POST | `/ventes/get-by-criteria` | `ventes` |
| POST | `/ventes/show` | `ventes` |
| POST | `/ventes/ligne-info` | `ventes` |
| POST | `/ventes/create` | `ventes_write` |
| POST | `/ventes/update` | `ventes_write` |
| POST | `/ventes/annuler` | `ventes_write` |
| POST | `/ventes/convertir-facture` | `ventes_write` |
| POST | `/ventes/valider` | `ventes_write` |
| POST | `/ventes/delete` | `ventes_write` |
| POST | `/ventes/retour` | `ventes_retour` |
| POST | `/ventes/paiement` | `ventes_paiement` |
| POST | `/ventes/paiements-search` | `ventes` |
| POST | `/ventes/document` | `ventes` |
| POST | `/ventes/imprimer` | `ventes` |
| POST | `/ventes/certify` | `ventes_certify` |
| POST | `/ventes/lock` | `ventes_write` |
| POST | `/ventes/lock-renew` | `ventes_write` |
| POST | `/ventes/unlock` | `ventes_write` |

### Create

```json
{
  "statut": "non_valide",
  "client_id": 1,
  "date_vente": "2026-06-15",
  "lignes": [
    {
      "produit_id": 3,
      "quantite": 2,
      "mode_vente": "piece",
      "remise_pct": 0
    }
  ]
}
```

`statut` à la création : `devis` \| `non_valide`  
`mode_vente` : `piece` (gros) \| `detail` (unité détail, si `venteAuDetail`)  
`prix_unitaire` : optionnel (TTC, selon mode)  
**AIRSI** : défini sur le **produit** (`produits.airsi_pct`), copié automatiquement sur chaque ligne — pas de champ `airsi_pct` sur la vente.

### Update

```json
{
  "id": 123,
  "remise_pct": 0,
  "lignes": [ ... ]
}
```

Refusé si `normalise = true` (422).

### Champs vente — totaux & AIRSI

L'AIRSI est **par produit** (catalogue) puis **par ligne** ; les totaux facture sont la **somme des lignes**.

| Champ | Description |
|-------|-------------|
| `totalTtc` | Total TTC brut (Σ lignes après remises) |
| `airsiPct` | Taux moyen pondéré affiché (`airsiMontant / totalTtc × 100`) |
| `airsiMontant` | Σ `ligne.airsiMontant` |
| `totalApresAirsi` | **Total à payer** (= Σ `ligne.montantApresAirsi`) |
| `resteAPayer` | `totalApresAirsi − montantPaye` |

**Formules par ligne** (`calcLigneAirsi` dans `fne_tva.ts`) :

- `airsi_montant` = `montant_ttc_ligne_après_remise_globale × airsi_pct / 100`
- `montant_apres_airsi` = `montant_ttc_ligne_après_remise_globale + airsi_montant`

La **remise globale** (`remise_pct` sur la vente) est appliquée d'abord sur HT/TVA/TTC ; l'AIRSI est calculé sur le **TTC final** (comme la FNE), pas sur le TTC brut des lignes.

**Exemple** : HT 25 424 + TVA 18 % → TTC 30 000 ; AIRSI 5 % → +1 500 → **total à payer 31 500**.

**Solde client** (création / mise à jour facture) : incrémenté de `totalApresAirsi`.  
**Relevé client** (`rapport_service`) : somme `total_ttc` des factures (hors AIRSI dans le débit relevé).

Une facture **déjà certifiée FNE** (`normalise = true`) ne peut plus être modifiée.

### Champs vente_lignes — AIRSI & FNE

| Champ | Description |
|-------|-------------|
| `airsiPct` | Taux copié depuis `produit.airsiPct` à la création de la ligne |
| `airsiMontant` | Montant AIRSI de la ligne (FCFA) |
| `montantApresAirsi` | `montantTtc + airsiMontant` |
| `fneItemId` | UUID ligne FNE (rempli après certification ; requis pour certifier un avoir) |
| `ligneOrigineId` | Ligne facture d'origine (sur les avoirs ; hérite `airsiPct` de l'origine) |

| Champ | Type | Description |
|-------|------|-------------|
| `normalise` | boolean | `true` = certifiée FNE |
| `testNormalise` | boolean | `true` si la FNE a renvoyé un avertissement test |
| `excluded` | boolean | `true` = exclue de la certification |
| `apiResponse` | string | JSON brut réponse FNE |
| `fneInvoiceId` | string | UUID facture/avoir FNE |
| `certifiedAt` | datetime | Date certification |
| `factureOrigineId` | number | Facture source (avoir / retour) |

### Certification FNE

Permission: `ventes_certify`

```json
// POST /ventes/certify
{ "id": 123 }

// ou par numéro
{ "numero": "01-FAC-2026-0001" }
```

**Facture** (`valide` uniquement) → envoi à la FNE (`POST .../external/invoices/sign`, `invoiceType: sale`).  
Les factures `non_valide` doivent d'abord être validées (`POST /ventes/valider`).  
**Avoir** (`retour`) → envoi à la FNE (`POST .../invoices/{fneInvoiceId}/refund`) avec corps `{ "items": [{ "id": "<fneItemId>", "quantity": N }] }`.

**Payload FNE facture** (extrait) :

- `amount` : `totalApresAirsi` si au moins une ligne a AIRSI, sinon `totalTtc`
- `items[]` : par ligne (hors timbre) — `quantity`, `reference`, `description`, `discount`, `amount` (PU HT), `taxes` (code TVA FNE), `customTaxes`
- `customTaxes` : `[{ "name": "AIRSI", "amount": <taux_pct> }]` — **`amount` = pourcentage**, pas montant FCFA (ex. 5 pour 5 %)
- Mapping TVA : 18 % → `TVA`, 9 % → `TVAB`, 0 % → `TVAC`

**Payload FNE avoir** : `{ "items": [{ "id": "<fneItemId ligne origine>", "quantity": <qty retour> }] }`  
Réponse succès avoir : `reference` + `token` (pas `invoice.id` comme sur une facture).

Prérequis facture :
- Statut **`valide`** (`non_valide` refusé — valider d'abord via `POST /ventes/valider`)
- Config FNE active (`/fne-config/upsert`)
- PDV : `point_of_sale`, `establishment`
- Client B2B : `ncc` renseigné
- Au moins 1 ligne
- `normalise = false`, `excluded = false`

Prérequis avoir :
- Facture d'origine certifiée (`normalise = true`, `fneInvoiceId` présent)
- Chaque ligne retour liée (`ligneOrigineId`) avec `fneItemId` sur la ligne d'origine

```json
// Response succès (facture)
{
  "data": {
    "message": "Facture certifiée avec succès",
    "vente": { "id": 123, "normalise": true, "fneInvoiceId": "uuid-...", ... },
    "lignes": [ ... ],
    "fne": {
      "statusCode": 200,
      "reference": "9606123E25000000019",
      "token": "https://fne.dgi.gouv.ci/verify/...",
      "invoice": { "id": "uuid-...", "items": [ ... ] }
    }
  }
}

// Response succès (avoir)
{
  "data": {
    "message": "Avoir certifié avec succès",
    ...
  }
}
```

Erreur métier → HTTP **422** avec `message` en français.

### Workflow certification (frontend)

```
1. Créer facture (non_valide)
2. POST /ventes/valider { id }
3. POST /ventes/certify { id }
4. Si normalise === true → afficher badge + QR (parser fne.token)
5. POST /ventes/imprimer → PDF avec QR intégré

Avoir :
1. Facture origine certifiée
2. POST /ventes/retour { facture_id, lignes }
3. POST /ventes/certify { id: retour_id }
4. Imprimer PDF avoir certifié
```

### Retour (avoir client)

`POST /ventes/retour` — permission `ventes_retour`

```json
{
  "facture_id": 123,
  "lignes": [{ "ligne_id": 10, "quantite": 1 }],
  "notes": "Retour marchandise"
}
```

Les totaux de l'avoir **reprennent la `remise_pct` de la facture d'origine** (remise globale + AIRSI sur TTC après remise), pour rester alignés avec la FNE.  
Montant crédité client / `reste_a_payer` facture : `totalApresAirsi` de l'avoir.

---

### Ligne-info

```json
// POST /ventes/ligne-info
{ "produit_id": 3, "quantite": 1, "mode_vente": "piece", "remise_pct": 0 }
```

Retourne `prix_unitaire`, montants ligne (`montant_ht`, `montant_tva`, `montant_ttc`), **AIRSI ligne** (`airsi_pct`, `airsi_montant`, `montant_apres_airsi`), `quantite_stock`, `stock_label`, `plancher`, `marge` (si permissions), `contenance`, `unite`, `unite_gros`, `vente_au_detail`.

Caisse **ouverte** requise pour créer/modifier une facture (`non_valide`).

### Totaux facture — marge & marge %

Champs sur l'objet `vente` (migration `1740000000041`) :

| Champ | Description |
|-------|-------------|
| `marge` | Somme des marges lignes (unitaire × quantité, remise ligne), ajustée si remise globale |
| `margePct` | `marge / totalTtc × 100` |

**Marge unitaire ligne** : `prix_unitaire − plancher_ligne` (TTC).

Calcul automatique à la création, mise à jour et conversion devis → facture (`calculerTotauxVente` + `calculerMargeFacture`).

**Visibilité (droits d'accès)** :

| Champ | Permission |
|-------|------------|
| `marge` (montant facture) | `ventes_ligne_marge` |
| `margePct` | `ventes_marge_pct` (défaut : admin, gérant — assignable par utilisateur) |
| `marge` sur ligne | `ventes_ligne_marge` |
| `plancher` sur ligne | `ventes_ligne_plancher` |

Sans permission, le champ est **omis** de la réponse (`show`, `create`, `update`, `document`).

### Document JSON

`POST /ventes/document` — aperçu structuré pour impression frontend.

Retourne `vente`, `lignes` (avec `airsiPct`, `airsiMontant`, `montantApresAirsi` par ligne), `totaux`, `client`, `type`, `statut_label`, `certification`, `facture_origine` (si avoir).

```json
{
  "data": {
    "type": "facture",
    "numero": "01-FAC-2026-0001",
    "totaux": {
      "total_ht": 1000,
      "tva": 180,
      "total_ttc": 1180,
      "airsi_pct": 5,
      "airsi_montant": 59,
      "total_apres_airsi": 1239,
      "reste_a_payer": 1239
    },
    "certification": {
      "normalise": true,
      "test_normalise": false,
      "certified_at": "2026-06-16T10:00:00.000+00:00",
      "fne_invoice_id": "uuid-fne-...",
      "fne": {
        "reference": "9606123E25000000019",
        "token": "https://fne.dgi.gouv.ci/verify/...",
        "qrContent": "https://fne.dgi.gouv.ci/verify/...",
        "invoiceId": "uuid-fne-..."
      }
    },
    "facture_origine": null
  }
}
```

Sur un **avoir** (`type: "retour"`), `facture_origine` contient `id`, `numero`, `fne_invoice_id`, `normalise`.

### Impression PDF

`POST /ventes/imprimer`

```json
{ "id": 12, "type": "facture" }
```

`type` : `facture` (facture / devis / avoir avec prix) \| `bon_sortie` (sans prix, facture validée uniquement).

Réponse : `application/pdf` (binaire).

En-têtes de réponse :

| Header | Description |
|--------|-------------|
| `X-Impression-Numero` | N° d'impression (1 = original) |
| `X-Impression-Label` | `ORIGINAL` ou `DUPLICATA` |
| `X-Impression-Duplicata` | `true` / `false` |
| `X-FNE-Certified` | `true` si `vente.normalise` |

Compteurs : `facture_impression_count`, `bon_sortie_impression_count` sur `ventes`.

**PDF facture certifiée** (`normalise = true`) :
- Bandeau « FACTURE CERTIFIEE FNE » ou « AVOIR CERTIFIE FNE »
- Colonne **Taxes** : `TVA X%` et `AIRSI Y%` par ligne si applicable ; montant ligne = `montantApresAirsi` si AIRSI > 0
- Bloc totaux : Total HT, TVA, Marge (si permission), Total TTC, **AIRSI** (si > 0), **Total a payer**
- Bloc vérification : QR code (depuis `fne.token`), référence FNE, ID facture
- Métadonnées : Ref. FNE, ID FNE, date certification

**Affichage QR côté frontend** (hors PDF) : parser `vente.apiResponse` ou utiliser `certification.fne` depuis `/ventes/document`. Champ `token` ou `qrContent` = URL à encoder en QR.

---

## Achats

Numéros : `{pdv}-ACH-{année}-{seq}`, avoir fournisseur `{pdv}-AVR-{année}-{seq}`.

### Statuts

| Statut | Description |
|--------|-------------|
| `commande` | Bon de commande (stock non reçu) |
| `achat` | Marchandise reçue (au moins partiellement) |
| `retour` | Avoir fournisseur |
| `annule` | Annulé |

### Lignes achat

- Saisie toujours en **unité gros** (`mode_achat: piece`)
- `quantite` = nombre de sacs/cartons
- `quantite_stock` = quantité en unité détail (ex. 55 sacs × 50 = 2750 kg)
- `prix_unitaire_ht` et `frais` = par **unité gros**

| Method | Path | Permission |
|--------|------|------------|
| POST | `/achats/search` | `achats` |
| POST | `/achats/get-by-criteria` | `achats` |
| POST | `/achats/show` | `achats` |
| POST | `/achats/ligne-info` | `achats` |
| POST | `/achats/create` | `achats_write` |
| POST | `/achats/update` | `achats_write` |
| POST | `/achats/annuler` | `achats_write` |
| POST | `/achats/recevoir` | `achats_write` |
| POST | `/achats/retour` | `achats_write` |
| POST | `/achats/paiement` | `achats_paiement` |

### Create

```json
{
  "fournisseur_id": 1,
  "date_achat": "2026-06-15",
  "reference_fournisseur": "BC-001",
  "lignes": [
    { "produit_id": 3, "quantite": 35, "prix_unitaire_ht": 25500, "frais": 50 }
  ]
}
```

`prix_unitaire_ht` optionnel — défaut : dernier prix gros connu (`dernierPrixAchatHt`).  
`frais` optionnel — défaut : **frais catalogue produit** (unité gros) si > 0, sinon frais du dernier achat.

### Ligne-info

```json
// POST /achats/ligne-info
{ "produit_id": 3, "quantite": 35, "prix_unitaire_ht": 25500 }
```

Retourne prévisualisation : `quantite_stock`, `stock_label`, `stock_label_apres`, `mode_achat`, `unite_quantite`, `frais`, `frais_gros`, `moyenne_achat_ht_apres`, etc.

Le champ `frais` est prérempli avec le **frais produit** (modifiable via le paramètre `frais` de la requête).

### Recevoir

```json
{
  "id": 15,
  "date_reception": "2026-06-15",
  "lignes": [{ "ligne_id": 17, "quantite_recue": 55 }]
}
```

Met à jour stock (× contenance), CMUP, `dernierPrixAchatHt`, solde fournisseur.

Paiement achat possible uniquement si `statut = achat` (marchandise reçue).

---

## Règlements

Règlement sur **compte** client/fournisseur (hors facture spécifique).

`nouveau_solde = ancien_solde - montant`

| Method | Path |
|--------|------|
| POST | `/reglements/client/create` |
| POST | `/reglements/client/search` |
| POST | `/reglements/client/show` |
| POST | `/reglements/fournisseur/create` |
| POST | `/reglements/fournisseur/search` |
| POST | `/reglements/fournisseur/show` |

Caisse **ouverte** (session active) requise pour **tous** les règlements client et fournisseur (espèces, chèque, virement, etc.).

Erreur si session fermée : *La caisse n'est pas ouverte. Ouvrez la caisse avant d'enregistrer une opération espèces.*

---

## Caisse

| Method | Path | Permission |
|--------|------|------------|
| GET | `/caisse/solde` | `caisse` |
| POST | `/caisse/mouvements/search` | `caisse` |
| POST | `/caisse/mouvements/show` | `caisse` |
| POST | `/caisse/get-by-criteria` | `caisse` |
| POST | `/caisse/ouverture` | `caisse_write` |
| POST | `/caisse/fermeture` | `caisse_write` |
| POST | `/caisse/session` | `caisse` |
| POST | `/caisse/sessions/search` | `caisse` |
| POST | `/caisse/sessions/get-by-criteria` | `caisse` |
| POST | `/caisse/sessions/show` | `caisse` |

### Session caisse

Une **session** est ouverte par `POST /caisse/ouverture` et fermée par `POST /caisse/fermeture`.  
Tant qu'aucune session n'est ouverte (`statut: fermee`), les opérations caisse suivantes sont **refusées** (422) :

| Opération | Session requise |
|-----------|-----------------|
| Factures vente (`non_valide`) — create/update | Oui |
| Paiements vente / achat **espèces** | Oui |
| **Dépenses** (create, update montant, delete) | Oui |
| **Règlements** client / fournisseur (tous modes) | Oui |
| Devis, commandes achat (sans mouvement caisse) | Non |

`GET /caisse/solde` inclut `sessionOuverte` si une session est active.

---

## Dépenses

| Method | Path | Permission |
|--------|------|------------|
| GET | `/depense-categories` | `depenses` |
| POST | `/depenses/search` | `depenses` |
| POST | `/depenses/show` | `depenses` |
| POST | `/depenses/create` | `depenses_write` |
| POST | `/depenses/update` | `depenses_admin` |
| POST | `/depenses/delete` | `depenses_admin` |

`categorie` : code libre (référentiel via `depense-categories`).

**Session caisse ouverte** requise pour créer, modifier (si montant change) ou supprimer une dépense.

---

## Stock

| Method | Path |
|--------|------|
| POST | `/stock/search` |
| POST | `/stock/mouvements/search` |
| GET | `/stock/valorisation` |
| POST | `/stock/alertes` |

`stock/search` : mêmes filtres que `produits/search` + `valeurStock` par ligne.

---

## Rapports

Permission: `rapports`. Header PDV requis.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rapports/caisse` | Mouvements caisse sur période |
| POST | `/rapports/stock-actuel` | Stock actuel par produit |
| POST | `/rapports/valeur-stock` | Valorisation stock (plancher × quantité) |
| POST | `/rapports/balance-clients` | Liste clients + solde PDV recalculé |
| POST | `/rapports/releve-client` | Relevé compte client (période) |
| POST | `/rapports/balance-fournisseurs` | Liste fournisseurs + solde PDV recalculé |
| POST | `/rapports/releve-fournisseur` | Relevé compte fournisseur (période) |
| POST | `/rapports/depenses` | Dépenses sur période |
| POST | `/rapports/chiffre-affaires` | Chiffre d'affaires sur période |
| POST | `/rapports/reglement-clients` | Règlements clients sur période |
| POST | `/rapports/reglement-fournisseurs` | Règlements fournisseurs sur période |

### Relevé client / fournisseur

```json
// POST /rapports/releve-client
{
  "client_id": 1,
  "date_from": "2026-06-01",
  "date_to": "2026-06-16",
  "page": 1,
  "limit": 50
}
```

```json
// POST /rapports/releve-fournisseur
{
  "fournisseur_id": 1,
  "date_from": "2026-06-01",
  "date_to": "2026-06-16",
  "page": 1,
  "limit": 50
}
```

Réponse : `periode`, `client`/`fournisseur`, `totaux` (`soldeInitial`, `totalDebit`, `totalCredit`, `soldeFinal`), `lignes` (mouvements paginés avec solde courant).

Le **solde final** du relevé utilise la même formule que les fiches compte (`search` / `show`).

### Règlements clients / fournisseurs

```json
// POST /rapports/reglement-clients
{
  "date_from": "2026-06-01",
  "date_to": "2026-06-16",
  "client_id": 1,
  "mode_paiement": "especes",
  "search": "dupont",
  "page": 1,
  "limit": 50
}
```

```json
// POST /rapports/reglement-fournisseurs
{
  "date_from": "2026-06-01",
  "date_to": "2026-06-16",
  "fournisseur_id": 1,
  "mode_paiement": "virement",
  "search": "acme",
  "page": 1,
  "limit": 50
}
```

Réponse : `periode`, `lignes` (règlements paginés avec client/fournisseur, montant, mode de paiement, soldes), `totaux` (`nombreReglements`, `totalEncaissements`, `totalRemboursements`, `totalNet`).

---

## Caisse — mouvements automatiques

| Événement | Caisse |
|-----------|--------|
| Paiement vente espèces | Entrée |
| Paiement avoir espèces | Sortie |
| Paiement achat espèces | Sortie |
| Encaissement retour fournisseur espèces | Entrée |
| Règlement client espèces (+) | Entrée |
| Règlement client espèces (−) | Sortie |
| Règlement fournisseur espèces (+) | Sortie |
| Dépense | Sortie |

Chèque, virement, mobile money, carte : **pas d'impact caisse**, mais l'enregistrement du règlement reste bloqué si la session est fermée.

---

## Quick reference — all endpoints

| Method | Path |
|--------|------|
| GET | `/health` |
| POST | `/api/v1/auth/login` |
| POST | `/api/v1/auth/logout` |
| GET | `/api/v1/auth/me` |
| POST | `/api/v1/auth/change-password` |
| POST | `/api/v1/points-de-vente/search` |
| POST | `/api/v1/points-de-vente/show` |
| POST | `/api/v1/points-de-vente/create` |
| POST | `/api/v1/points-de-vente/update` |
| POST | `/api/v1/points-de-vente/deactivate` |
| POST | `/api/v1/fne-config/show` |
| POST | `/api/v1/fne-config/upsert` |
| POST | `/api/v1/users/search` |
| POST | `/api/v1/users/show` |
| POST | `/api/v1/users/create` |
| POST | `/api/v1/users/update` |
| POST | `/api/v1/users/deactivate` |
| POST | `/api/v1/users/permissions-catalog` |
| POST | `/api/v1/users/permissions/show` |
| POST | `/api/v1/users/permissions/update` |
| POST | `/api/v1/admin/tva-groupes/search` |
| POST | `/api/v1/admin/tva-groupes/show` |
| POST | `/api/v1/admin/tva-groupes/create` |
| POST | `/api/v1/admin/tva-groupes/update` |
| POST | `/api/v1/admin/tva-groupes/deactivate` |
| POST | `/api/v1/admin/categories/search` |
| POST | `/api/v1/admin/categories/show` |
| POST | `/api/v1/admin/categories/create` |
| POST | `/api/v1/admin/categories/update` |
| POST | `/api/v1/admin/categories/delete` |
| POST | `/api/v1/admin/depense-categories/search` |
| POST | `/api/v1/admin/depense-categories/show` |
| POST | `/api/v1/admin/depense-categories/create` |
| POST | `/api/v1/admin/depense-categories/update` |
| POST | `/api/v1/admin/depense-categories/delete` |
| POST | `/api/v1/clients/search` |
| POST | `/api/v1/clients/show` |
| POST | `/api/v1/clients/create` |
| POST | `/api/v1/clients/update` |
| POST | `/api/v1/clients/deactivate` |
| POST | `/api/v1/clients/ventes` |
| POST | `/api/v1/clients/solde` |
| POST | `/api/v1/fournisseurs/search` |
| POST | `/api/v1/fournisseurs/show` |
| POST | `/api/v1/fournisseurs/create` |
| POST | `/api/v1/fournisseurs/update` |
| POST | `/api/v1/fournisseurs/deactivate` |
| POST | `/api/v1/fournisseurs/achats` |
| POST | `/api/v1/categories/search` |
| POST | `/api/v1/categories/show` |
| POST | `/api/v1/categories/create` |
| POST | `/api/v1/categories/update` |
| POST | `/api/v1/categories/delete` |
| GET | `/api/v1/tva-groupes` |
| POST | `/api/v1/tva-groupes/show` |
| POST | `/api/v1/produits/search` |
| POST | `/api/v1/produits/show` |
| POST | `/api/v1/produits/create` |
| POST | `/api/v1/produits/update` |
| POST | `/api/v1/produits/deactivate` |
| POST | `/api/v1/produits/alertes` |
| POST | `/api/v1/produits/ajustement` |
| POST | `/api/v1/produits/calcul-prix` |
| POST | `/api/v1/ventes/search` |
| POST | `/api/v1/ventes/get-by-criteria` |
| POST | `/api/v1/ventes/show` |
| POST | `/api/v1/ventes/ligne-info` |
| POST | `/api/v1/ventes/create` |
| POST | `/api/v1/ventes/update` |
| POST | `/api/v1/ventes/annuler` |
| POST | `/api/v1/ventes/convertir-facture` |
| POST | `/api/v1/ventes/valider` |
| POST | `/api/v1/ventes/delete` |
| POST | `/api/v1/ventes/retour` |
| POST | `/api/v1/ventes/paiement` |
| POST | `/api/v1/ventes/paiements-search` |
| POST | `/api/v1/ventes/document` |
| POST | `/api/v1/ventes/imprimer` |
| POST | `/api/v1/ventes/certify` |
| POST | `/api/v1/ventes/lock` |
| POST | `/api/v1/ventes/lock-renew` |
| POST | `/api/v1/ventes/unlock` |
| POST | `/api/v1/reglements/client/create` |
| POST | `/api/v1/reglements/client/search` |
| POST | `/api/v1/reglements/client/show` |
| POST | `/api/v1/reglements/fournisseur/create` |
| POST | `/api/v1/reglements/fournisseur/search` |
| POST | `/api/v1/reglements/fournisseur/show` |
| POST | `/api/v1/achats/search` |
| POST | `/api/v1/achats/get-by-criteria` |
| POST | `/api/v1/achats/show` |
| POST | `/api/v1/achats/ligne-info` |
| POST | `/api/v1/achats/create` |
| POST | `/api/v1/achats/update` |
| POST | `/api/v1/achats/annuler` |
| POST | `/api/v1/achats/recevoir` |
| POST | `/api/v1/achats/retour` |
| POST | `/api/v1/achats/paiement` |
| GET | `/api/v1/caisse/solde` |
| POST | `/api/v1/caisse/mouvements/search` |
| POST | `/api/v1/caisse/get-by-criteria` |
| POST | `/api/v1/caisse/mouvements/show` |
| POST | `/api/v1/caisse/ouverture` |
| POST | `/api/v1/caisse/fermeture` |
| POST | `/api/v1/caisse/session` |
| POST | `/api/v1/caisse/sessions/search` |
| POST | `/api/v1/caisse/sessions/get-by-criteria` |
| POST | `/api/v1/caisse/sessions/show` |
| GET | `/api/v1/depense-categories` |
| POST | `/api/v1/depenses/search` |
| POST | `/api/v1/depenses/show` |
| POST | `/api/v1/depenses/create` |
| POST | `/api/v1/depenses/update` |
| POST | `/api/v1/depenses/delete` |
| POST | `/api/v1/stock/search` |
| POST | `/api/v1/stock/mouvements/search` |
| GET | `/api/v1/stock/valorisation` |
| POST | `/api/v1/stock/alertes` |
| POST | `/api/v1/rapports/caisse` |
| POST | `/api/v1/rapports/stock-actuel` |
| POST | `/api/v1/rapports/valeur-stock` |
| POST | `/api/v1/rapports/balance-clients` |
| POST | `/api/v1/rapports/releve-client` |
| POST | `/api/v1/rapports/balance-fournisseurs` |
| POST | `/api/v1/rapports/releve-fournisseur` |
| POST | `/api/v1/rapports/depenses` |
| POST | `/api/v1/rapports/chiffre-affaires` |
| POST | `/api/v1/rapports/reglement-clients` |
| POST | `/api/v1/rapports/reglement-fournisseurs` |

---

## Security notes

| Topic | Behaviour |
|-------|-----------|
| Auth | Bearer access tokens (`auth_access_tokens`). Pas d'inscription publique. |
| CSRF | Désactivé (API token) |
| Rate limiting | Login uniquement. Prod : `LIMITER_STORE=database` |
| Tests | `.env.test` → `gestio_test`, `LIMITER_STORE=memory` |

Compte seed : `admin@gestion.com` / `Admin@123456`
