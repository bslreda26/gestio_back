# Gestion Commerciale — API Reference

Base URL: `/api/v1`

Convention: **GET** and **POST** only (no PUT/PATCH/DELETE).

---

## Authentication & headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Protected routes | `Bearer <token>` from login |
| `Content-Type` | POST bodies | `application/json` |
| `X-Point-De-Vente-Id` | Business routes* | Point de vente ID (integer) |

\* Required on all routes under the business group (clients, ventes, stock, etc.). **Not** required for `/auth/*`, `/users/*`, `/points-de-vente/*`.

**Admin users** must send `X-Point-De-Vente-Id` on every business call. **Other roles** are scoped to their assigned point de vente automatically.

### Multi point de vente (scoping)

| Scope | Tables / modules |
|-------|------------------|
| Per point de vente | `clients`, `produits`, `categories`, `ventes`, `achats`, `caisses`, `depenses`, `reglements` |
| Shared (all PDV) | `fournisseurs` |
| Admin only (no PDV header) | `points-de-vente`, `users` |

Rules:

- Non-admin users have a fixed `point_de_vente_id` on their account; sending a different `X-Point-De-Vente-Id` returns **403**.
- `clients.code` and `produits.code` are unique **per** point de vente (not globally).
- Document numbers are prefixed with the PDV code: `{code}-DEV-{année}-{seq}`, `{code}-FAC-…`, `{code}-ACH-…`, `{code}-RET-…`.
- Creating a point de vente auto-creates its default **caisse**.
- `GET /auth/me` returns `point_de_vente_id` and the list of `points_de_vente` the user may work with (all active PDV for admin).

---

## Response format

### Success (single object)

```json
{
  "data": { }
}
```

### Success (paginated list)

```json
{
  "data": [ ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "lastPage": 3
  }
}
```

### Error

```json
{
  "message": "Description de l'erreur en français",
  "errors": {
    "field": ["message de validation"]
  }
}
```

| Status | Usage |
|--------|--------|
| 200 | Success |
| 400 | Bad request / point de vente manquant |
| 401 | Non authentifié |
| 403 | Accès refusé |
| 404 | Ressource introuvable |
| 409 | Conflit (ex: verrou vente) |
| 422 | Règle métier / validation |
| 429 | Trop de tentatives (ex: login rate limit) |

### Pagination defaults

- `page`: 1
- `limit`: 20 (max 100)

---

## Health

### `GET /health`

Public. No auth.

**Response `200`**

```json
{ "status": "ok" }
```

---

## Auth

### `POST /api/v1/auth/login`

Public. Protected against brute-force by `@adonisjs/limiter` (dual limits on failed attempts only):

| Key | Limit |
|-----|--------|
| Per IP | 10 failed attempts / minute |
| Per IP + email | 5 failed attempts / minute, then **20 min** block |

Successful login resets the counters. Store: `LIMITER_STORE=database` in production (`rate_limits` table), `memory` in tests.

**Payload**

```json
{
  "email": "admin@gestion.com",
  "password": "Admin@123456"
}
```

**Response `200`**

```json
{
  "data": {
    "user": {
      "id": 1,
      "fullName": "Admin Système",
      "email": "admin@gestion.com",
      "createdAt": "...",
      "updatedAt": "...",
      "initials": "AS"
    },
    "token": "oat_..."
  }
}
```

**Response `401`** — invalid credentials

```json
{ "message": "Identifiants invalides" }
```

**Response `403`** — account disabled

```json
{ "message": "Compte désactivé" }
```

**Response `429`** — rate limit exceeded

```json
{
  "message": "Trop de tentatives de connexion. Réessayez dans 847 secondes."
}
```

### `POST /api/v1/auth/logout`

Auth required.

**Response `200`**

```json
{ "message": "Déconnexion réussie" }
```

### `GET /api/v1/auth/me`

Auth required.

**Response `200`**

```json
{
  "data": {
    "id": 1,
    "fullName": "Admin Système",
    "email": "admin@gestion.com",
    "point_de_vente_id": null,
    "points_de_vente": [
      { "id": 1, "code": "01", "nom": "Point de vente principal" }
    ]
  }
}
```

### `POST /api/v1/auth/change-password`

Auth required.

**Payload**

```json
{
  "currentPassword": "Admin@123456",
  "newPassword": "NewSecure@123"
}
```

**Response `200`**

```json
{ "message": "Mot de passe modifié avec succès" }
```

---

## Points de vente

Admin only. Auth required. **No** `X-Point-De-Vente-Id`.

### `POST /api/v1/points-de-vente/search`

**Payload**

```json
{
  "page": 1,
  "limit": 20,
  "nom": "Cocody",
  "code": "02",
  "ville": "Abidjan",
  "is_active": true,
  "search": "boutique"
}
```

**Response `200`**

```json
{
  "data": [
    {
      "id": 1,
      "code": "01",
      "nom": "Point de vente principal",
      "adresse": null,
      "ville": null,
      "telephone": null,
      "is_active": true,
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "lastPage": 1 }
}
```

### `POST /api/v1/points-de-vente/show`

**Payload** `{ "id": 1 }`

**Response `200`** — single point de vente object in `data`.

### `POST /api/v1/points-de-vente/create`

**Payload**

```json
{
  "code": "02",
  "nom": "Boutique Cocody",
  "adresse": "Rue des jardins",
  "ville": "Abidjan",
  "telephone": "+225 07 00 00 00"
}
```

**Response `200`** — created point de vente (+ caisse auto-créée).

### `POST /api/v1/points-de-vente/update`

**Payload**

```json
{
  "id": 2,
  "nom": "Boutique Cocody Centre",
  "is_active": true
}
```

### `POST /api/v1/points-de-vente/deactivate`

**Payload** `{ "id": 2 }`

**Response `200`**

```json
{
  "data": {
    "message": "Point de vente désactivé",
    "point_de_vente": { }
  }
}
```

---

## Users

Admin only. Auth required. **No** `X-Point-De-Vente-Id`.

### `POST /api/v1/users/search`

**Payload**

```json
{
  "page": 1,
  "limit": 20,
  "nom": "Kouassi",
  "email": "user@example.com",
  "role": "caissier",
  "is_active": true,
  "search": "jean"
}
```

**Response `200`** — paginated list of users (`id`, `nom`, `prenom`, `email`, `role`, `is_active`, `point_de_vente_id`, …).

### `POST /api/v1/users/show`

**Payload** `{ "id": 3 }`

### `POST /api/v1/users/create`

**Payload**

```json
{
  "nom": "Kouassi",
  "prenom": "Jean",
  "email": "jean@example.com",
  "password": "Secure@12345",
  "role": "caissier",
  "point_de_vente_id": 1
}
```

| Field | Notes |
|-------|--------|
| `role` | `admin` \| `gestionnaire` \| `caissier` \| `lecteur` |
| `point_de_vente_id` | Required for non-admin roles |

### `POST /api/v1/users/update`

**Payload**

```json
{
  "id": 3,
  "nom": "Kouassi",
  "prenom": "Jean",
  "email": "jean@example.com",
  "password": "NewPass@123",
  "role": "gestionnaire",
  "is_active": true,
  "point_de_vente_id": 1
}
```

### `POST /api/v1/users/deactivate`

**Payload** `{ "id": 3 }`

---

## Clients

Auth + `X-Point-De-Vente-Id` required. Data scoped per point de vente.

### `POST /api/v1/clients/search`

**Payload**

```json
{
  "page": 1,
  "limit": 20,
  "nom": "Dupont",
  "code": "CLI",
  "telephone": "07",
  "ville": "Abidjan",
  "type": "B2B",
  "is_active": true,
  "search": "dupont"
}
```

| `type` | `B2B` \| `B2C` \| `B2F` \| `B2G` |

**Response `200`** — paginated clients.

### `POST /api/v1/clients/show`

**Payload** `{ "id": 1 }`

**Response `200`**

```json
{
  "data": {
    "client": {
      "id": 1,
      "code": "CLI-0001",
      "nom": "Client Démo",
      "type": "B2C",
      "email": "client@demo.ci",
      "telephone": "+225 07 00 00 02",
      "ville": "Abidjan",
      "pays": "Côte d'Ivoire",
      "creditLimit": "500000.00",
      "solde": "0.00",
      "isActive": true,
      "pointDeVenteId": 1
    },
    "recentVentes": [ ]
  }
}
```

### `POST /api/v1/clients/create`

**Payload**

```json
{
  "nom": "Société ABC",
  "type": "B2B",
  "email": "contact@abc.ci",
  "telephone": "+225 07 11 22 33",
  "adresse": "Zone 4",
  "ville": "Abidjan",
  "pays": "Côte d'Ivoire",
  "credit_limit": 1000000,
  "notes": "Client grossiste"
}
```

| Field | Default |
|-------|---------|
| `type` | `B2C` |
| `pays` | `Côte d'Ivoire` |
| `credit_limit` | `0` |

**Response `200`** — created client (code auto: `CLI-0001`).

### `POST /api/v1/clients/update`

**Payload**

```json
{
  "id": 1,
  "nom": "Société ABC SARL",
  "type": "B2G",
  "credit_limit": 2000000,
  "is_active": true
}
```

### `POST /api/v1/clients/deactivate`

**Payload** `{ "id": 1 }`

### `POST /api/v1/clients/ventes`

**Payload**

```json
{
  "id": 1,
  "page": 1,
  "limit": 20,
  "statut": "facture",
  "date_from": "2026-01-01",
  "date_to": "2026-12-31"
}
```

**Response `200`** — paginated ventes for client.

### `POST /api/v1/clients/solde`

**Payload** `{ "id": 1 }`

**Response `200`**

```json
{
  "data": {
    "client": { "id": 1, "nom": "...", "code": "CLI-0001", "solde": "15000.00" },
    "totalCreances": 15000,
    "paiements": [ ]
  }
}
```

---

## Fournisseurs

Auth + `X-Point-De-Vente-Id` required. Fournisseurs are **shared** across points de vente.

### `POST /api/v1/fournisseurs/search`

**Payload**

```json
{
  "page": 1,
  "limit": 20,
  "nom": "Principal",
  "code": "FRN",
  "ville": "Abidjan",
  "is_active": true,
  "search": "fournisseur"
}
```

### `POST /api/v1/fournisseurs/show`

**Payload** `{ "id": 1 }`

**Response `200`**

```json
{
  "data": {
    "fournisseur": { "id": 1, "code": "FRN-0001", "nom": "...", "solde": "0.00" },
    "recentAchats": [ ]
  }
}
```

### `POST /api/v1/fournisseurs/create`

**Payload**

```json
{
  "nom": "Fournisseur XYZ",
  "email": "contact@xyz.ci",
  "telephone": "+225 07 00 00 01",
  "adresse": "Marcory",
  "ville": "Abidjan",
  "pays": "Côte d'Ivoire",
  "contact_nom": "M. Diallo",
  "notes": ""
}
```

### `POST /api/v1/fournisseurs/update`

**Payload** `{ "id": 1, "nom": "...", "is_active": true }`

### `POST /api/v1/fournisseurs/deactivate`

**Payload** `{ "id": 1 }`

### `POST /api/v1/fournisseurs/achats`

**Payload**

```json
{
  "id": 1,
  "page": 1,
  "limit": 20,
  "statut": "recu",
  "date_from": "2026-01-01",
  "date_to": "2026-12-31"
}
```

---

## Catégories

Auth + `X-Point-De-Vente-Id`. Scoped per point de vente.

### `POST /api/v1/categories/search`

**Payload** `{ "page": 1, "limit": 20, "nom": "Alimentation" }`

### `POST /api/v1/categories/show`

**Payload** `{ "id": 1 }`

**Response `200`**

```json
{
  "data": {
    "categorie": { "id": 1, "nom": "Alimentation", "description": "..." },
    "produitsCount": 5
  }
}
```

### `POST /api/v1/categories/create`

**Payload** `{ "nom": "Électronique", "description": "..." }`

### `POST /api/v1/categories/update`

**Payload** `{ "id": 1, "nom": "Électronique & accessoires" }`

### `POST /api/v1/categories/delete`

**Payload** `{ "id": 1 }` — fails if products linked.

---

## TVA groupes

Read-only reference data.

### `GET /api/v1/tva-groupes`

**Response `200`**

```json
{
  "data": [
    { "id": 1, "code": "TVA18", "libelle": "TVA 18%", "taux": "18.00", "isActive": true }
  ]
}
```

### `POST /api/v1/tva-groupes/show`

**Payload** `{ "id": 1 }`

---

## Produits

Auth + `X-Point-De-Vente-Id`. Scoped per point de vente.

### `POST /api/v1/produits/search`

**Payload**

```json
{
  "page": 1,
  "limit": 20,
  "nom": "Riz",
  "code": "PRD",
  "categorie_id": 1,
  "tva_groupe_id": 1,
  "is_active": true,
  "stock_alert": "alerte",
  "search": "riz"
}
```

| `stock_alert` | `rupture` \| `alerte` \| `normal` \| `surstock` |

### `POST /api/v1/produits/show`

**Payload** `{ "id": 1 }`

### `POST /api/v1/produits/create`

**Payload**

```json
{
  "nom": "Riz 25kg",
  "code": "PRD-0010",
  "description": "Riz importé",
  "categorie_id": 1,
  "tva_groupe_id": 1,
  "unite": "pièce",
  "stock_minimum": 10,
  "stock_maximum": 500
}
```

Champs prix optionnels : `prix_achat_ht`, `prix_vente_ttc`, `frais` (défaut `0`). Si `prix_vente_ttc` est renseigné, le HT et le plancher sont calculés automatiquement. Le **prix d'achat HT** de la fiche produit est mis à jour à la **réception** du dernier achat. Code auto `PRD-XXXX` si omis.

### `POST /api/v1/produits/update`

**Payload** `{ "id": 1, "prix_vente_ht": 16000, "is_active": true }`

### `POST /api/v1/produits/deactivate`

**Payload** `{ "id": 1 }`

### `POST /api/v1/produits/alertes`

Stock ≤ stock_minimum. **Payload** `{ "page": 1, "limit": 20 }`

### `POST /api/v1/produits/ajustement`

**Payload**

```json
{
  "id": 1,
  "type": "entree",
  "quantite": 50,
  "notes": "Inventaire initial"
}
```

| `type` | `entree` \| `sortie` |

### `POST /api/v1/produits/calcul-prix`

**Payload**

```json
{
  "prix_vente_ttc": 17700,
  "tva_groupe_id": 1
}
```

`prix_achat_ht`, `prix_vente_ttc` et `frais` sont optionnels (défaut `0`).

**Response `200`**

```json
{
  "data": {
    "tva_groupe": { },
    "prix_achat_ht": 12000,
    "prix_vente_ttc": 17700,
    "prix_vente_ht": 15000,
    "frais": 500,
    "prix_achat_ttc": 14160,
    "plancher": 18200
  }
}
```

---

## Ventes

Auth + `X-Point-De-Vente-Id`.

Numéros format: `{code_pdv}-FAC-{année}-{seq}` (ex: `01-FAC-2026-0001`).

### `POST /api/v1/ventes/search`

**Payload**

```json
{
  "page": 1,
  "limit": 20,
  "type": "vente",
  "statut": "facture",
  "statut_paiement": "non_paye",
  "client_id": 1,
  "user_id": 2,
  "numero": "01-FAC",
  "date_from": "2026-01-01",
  "date_to": "2026-12-31",
  "search": "FAC-2026"
}
```

| `type` | `vente` (default list) \| `retour` (`facture_retour` only) |

### `POST /api/v1/ventes/get-by-criteria`

Same filters as `search`, but **`date_from` and `date_to` are required**. Paged response (`data` + `meta`).

```json
{
  "page": 1,
  "limit": 20,
  "type": "retour",
  "date_from": "2026-01-01",
  "date_to": "2026-12-31",
  "client_id": 1
}
```

### `POST /api/v1/ventes/show`

**Payload** `{ "id": 1 }`

**Response `200`**

```json
{
  "data": {
    "vente": { "id": 1, "numero": "01-FAC-2026-0001", "statut": "facture", "totalTtc": "17700.00" },
    "lignes": [
      {
        "id": 1,
        "produitId": 1,
        "designation": "Riz 25kg",
        "quantite": "1.000",
        "prixUnitaire": 18200,
        "marge": 0,
        "montantTtc": "18200.00"
      }
    ],
    "client": { },
    "user": { },
    "paiements": [ ],
    "factureOrigine": null,
    "retours": [ ],
    "lock": { "is_locked": false, "is_locked_by_me": false }
  }
}
```

> `marge` visible only for **admin**.

### `POST /api/v1/ventes/ligne-info`

Call when the user **selects a product** on a vente/devis line — returns the default **`prix_unitaire`** from `produit.prix_vente_ttc`.

**Payload**

```json
{
  "produit_id": 1,
  "quantite": 1,
  "remise_pct": 0
}
```

**Response `200`**

```json
{
  "data": {
    "produit_id": 1,
    "code": "PRD-0001",
    "designation": "Riz 25kg",
    "quantite": 1,
    "prix_unitaire": 18200,
    "prix_vente_ttc": 18200,
    "remise_pct": 0,
    "tva_pct": 18,
    "montant_ht": 15423.73,
    "montant_tva": 2776.27,
    "montant_ttc": 18200,
    "stock_actuel": 50
  }
}
```

> `plancher` and `marge` included for **admin** only.

### `POST /api/v1/ventes/create`

**Payload**

```json
{
  "statut": "facture",
  "client_id": 1,
  "date_vente": "2026-06-10",
  "date_echeance": "2026-07-10",
  "remise_pct": 0,
  "remise_montant": 0,
  "notes": "",
  "lignes": [
    {
      "produit_id": 1,
      "quantite": 2,
      "remise_pct": 0
    }
  ]
}
```

| `statut` | `devis` \| `facture` |
| `prix_unitaire` | Optional — defaults to `produit.prix_vente_ttc` (TTC). Must be ≥ plancher for facture |

**Response `200`**

```json
{
  "data": {
    "vente": { },
    "lignes": [ ]
  }
}
```

### `POST /api/v1/ventes/update`

Devis ou **facture non validée** (`statut = facture`). Lock required. Refusé si facture validée, payée ou liée à un retour.

**Payload**

```json
{
  "id": 1,
  "client_id": 1,
  "date_vente": "2026-06-11",
  "notes": "Modifié",
  "lignes": [ { "produit_id": 1, "quantite": 3, "prix_unitaire": 18000 } ]
}
```

### `POST /api/v1/ventes/annuler`

**Payload** `{ "id": 1, "notes": "Annulation client" }` — devis only.

### `POST /api/v1/ventes/convertir-facture`

**Payload** `{ "id": 1 }` — devis → facture, lock required.

### `POST /api/v1/ventes/valider`

**Payload** `{ "id": 1 }` — facture → facture_valide.

### `POST /api/v1/ventes/delete`

**Payload** `{ "id": 1 }` — lock required.

Supprime une **facture non validée** (`statut = facture`). Retourne les articles au stock et annule le solde client. Refusé si la facture est validée, payée (même partiellement) ou liée à un retour.

### `POST /api/v1/ventes/retour`

Admin only. **Payload**

```json
{
  "facture_id": 1,
  "notes": "Retour partiel",
  "lignes": [
    { "ligne_id": 1, "quantite": 1 }
  ]
}
```

### `POST /api/v1/ventes/paiement`

**Payload**

```json
{
  "vente_id": 1,
  "montant": 10000,
  "mode_paiement": "especes",
  "date_paiement": "2026-06-10",
  "reference_paiement": "ESP-001",
  "notes": ""
}
```

| `mode_paiement` | `especes` \| `cheque` \| `virement` \| `mobile_money` \| `carte` |

**Caisse (espèces only, caisse must be open)**

| Document | Mouvement caisse |
|----------|------------------|
| Facture / vente | **ENTRÉE** (`vente_especes`) — encaissement client |
| Facture retour | **SORTIE** (`retour_especes`) — remboursement client |

### `POST /api/v1/ventes/paiements-search`

**Payload** `{ "vente_id": 1, "page": 1, "limit": 20 }`

### `POST /api/v1/ventes/document`

**Payload** `{ "id": 1 }` — JSON document for print/PDF.

### `POST /api/v1/ventes/lock` | `lock-renew` | `unlock`

| Endpoint | Payload |
|----------|---------|
| `lock` | `{ "id": 1 }` |
| `lock-renew` | `{ "id": 1 }` |
| `unlock` | `{ "id": 1, "force": false }` |

---

## Règlements

Auth + `X-Point-De-Vente-Id`. Settlement on client/fournisseur **account balance** (not tied to a specific invoice).

| Montant | Client | Fournisseur |
|---------|--------|-------------|
| **> 0** | Solde client ↓, caisse ↑ | Solde fournisseur ↓, caisse ↓ |
| **< 0** | Solde client ↑, caisse ↓ | Solde fournisseur ↑, caisse ↑ |

Formule: `nouveau_solde = ancien_solde - montant`

### `POST /api/v1/reglements/client/create`

Settles the **client account** (`solde`). `montant` can be **positive or negative** (not zero).

| `montant` | Meaning | Client `solde` | Caisse (espèces only) |
|-----------|---------|----------------|------------------------|
| **+** | Client pays you | Decreases | **Entrée** |
| **−** | You refund the client | Increases | **Sortie** |

Caisse must be **open** for `mode_paiement: "especes"`. Other modes update the client balance only.

**Payload**

```json
{
  "client_id": 1,
  "montant": 50000,
  "mode_paiement": "especes",
  "date_reglement": "2026-06-10",
  "reference_externe": "CHQ-12345",
  "notes": "Règlement compte client"
}
```

**Response `200`**

```json
{
  "data": {
    "message": "Règlement client enregistré",
    "reglement": {
      "id": 1,
      "type": "client",
      "montant": "50000.00",
      "solde_avant": "80000.00",
      "solde_apres": "30000.00",
      "mode_paiement": "especes",
      "date_reglement": "2026-06-10"
    },
    "client": { "id": 1, "code": "CLI-0001", "nom": "...", "solde": "30000.00" }
  }
}
```

### `POST /api/v1/reglements/client/search`

**Payload**

```json
{
  "page": 1,
  "limit": 20,
  "client_id": 1,
  "date_from": "2026-01-01",
  "date_to": "2026-12-31"
}
```

### `POST /api/v1/reglements/client/show`

**Payload** `{ "id": 1 }`

### `POST /api/v1/reglements/fournisseur/create`

Settles the **supplier account** (`solde`). `montant` can be **positive or negative** (not zero).

| `montant` | Meaning | Fournisseur `solde` | Caisse (espèces only) |
|-----------|---------|---------------------|------------------------|
| **+** | You pay the supplier | Decreases | **Sortie** |
| **−** | Supplier refunds you | Increases | **Entrée** |

**Payload**

```json
{
  "fournisseur_id": 1,
  "montant": 30000,
  "mode_paiement": "especes",
  "date_reglement": "2026-06-10",
  "reference_externe": "VIR-98765",
  "notes": "Paiement fournisseur"
}
```

### `POST /api/v1/reglements/fournisseur/search`

**Payload** `{ "page": 1, "fournisseur_id": 1, "date_from": "...", "date_to": "..." }`

### `POST /api/v1/reglements/fournisseur/show`

**Payload** `{ "id": 1 }`

---

## Achats

Auth + `X-Point-De-Vente-Id`. Numéros: `{code_pdv}-ACH-{année}-{seq}`.

### `POST /api/v1/achats/search`

**Payload**

```json
{
  "page": 1,
  "limit": 20,
  "type": "achat",
  "statut": "recu",
  "statut_paiement": "non_paye",
  "fournisseur_id": 1,
  "numero": "01-ACH",
  "date_from": "2026-01-01",
  "date_to": "2026-12-31"
}
```

| `type` | `achat` \| `retour` (`achat_retour` / avoir fournisseur) |

### `POST /api/v1/achats/get-by-criteria`

Same filters as `search`, but **`date_from` and `date_to` are required**. Paged response.

```json
{
  "page": 1,
  "limit": 20,
  "type": "achat",
  "date_from": "2026-01-01",
  "date_to": "2026-12-31",
  "fournisseur_id": 1
}
```

### `POST /api/v1/achats/show`

**Payload** `{ "id": 1 }`

### `POST /api/v1/achats/create`

**Payload**

```json
{
  "fournisseur_id": 1,
  "date_achat": "2026-06-10",
  "reference_fournisseur": "BC-2026-001",
  "remise_montant": 0,
  "notes": "",
  "lignes": [
    {
      "produit_id": 1,
      "quantite": 100,
      "prix_unitaire_ht": 12000
    }
  ]
}
```

`prix_unitaire_ht` est optionnel : par défaut le dernier **prix d'achat HT** connu du produit (`produit.prix_achat_ht`, mis à jour à chaque réception). Obligatoire si le produit n'a jamais été acheté.

### `POST /api/v1/achats/update`

Commande only. **Payload** `{ "id": 1, "lignes": [ ... ] }`

### `POST /api/v1/achats/annuler`

**Payload** `{ "id": 1, "notes": "" }`

### `POST /api/v1/achats/recevoir`

**Payload**

```json
{
  "id": 1,
  "date_reception": "2026-06-12",
  "lignes": [
    { "ligne_id": 1, "quantite_recue": 100 }
  ]
}
```

Met à jour le stock et le **prix d'achat HT** (et TTC) de chaque produit avec le prix de la ligne d'achat reçue.

Updates stock and fournisseur solde.

### `POST /api/v1/achats/retour`

Creates an **avoir fournisseur** (`statut: achat_retour`, numero `01-AVR-YYYY-XXXX`). Quantities are **added back to stock** immediately.

**Payload**

```json
{
  "achat_id": 1,
  "notes": "Produits défectueux",
  "lignes": [
    { "ligne_id": 1, "quantite": 2 }
  ]
}
```

Requires a received purchase (`recu` or `partiel`). `quantite` cannot exceed received quantity minus already returned.

### `POST /api/v1/achats/paiement`

**Payload**

```json
{
  "achat_id": 1,
  "montant": 500000,
  "mode_paiement": "virement",
  "date_paiement": "2026-06-15",
  "reference_paiement": "VIR-001",
  "notes": ""
}
```

**Caisse (espèces only, caisse must be open)**

| Document | Mouvement caisse |
|----------|------------------|
| Achat normal | **SORTIE** (`achat_especes`) — paiement fournisseur |
| Avoir / retour fournisseur | **ENTRÉE** (`retour_achat_especes`) — remboursement reçu du fournisseur |

---

## Caisse

Auth + `X-Point-De-Vente-Id`.

### `GET /api/v1/caisse/solde`

**Response `200`**

```json
{
  "data": {
    "caisseId": 1,
    "nom": "Caisse principale",
    "soldeActuel": 1250000
  }
}
```

### `POST /api/v1/caisse/mouvements/search`

**Payload**

```json
{
  "page": 1,
  "limit": 20,
  "type": "entree",
  "motif": "reglement_client",
  "date_from": "2026-01-01",
  "date_to": "2026-12-31",
  "caisse_id": 1
}
```

**Response `200`**

```json
{
  "data": {
    "mouvements": [ ],
    "caisse": { "id": 1, "nom": "...", "soldeActuel": 1250000 }
  },
  "meta": { }
}
```

### `POST /api/v1/caisse/mouvements/show`

**Payload** `{ "id": 1 }`

### `POST /api/v1/caisse/get-by-criteria`

Paged search with **required** `date_from` and `date_to`.

```json
{
  "page": 1,
  "limit": 20,
  "date_from": "2026-01-01",
  "date_to": "2026-12-31",
  "cible": "mouvements",
  "type": "sortie",
  "motif": "retour_especes",
  "caisse_id": 1,
  "caisse_session_id": 1
}
```

| `cible` | `mouvements` (default) \| `sessions` |
| `type` | For mouvements: `entree` \| `sortie` |
| `statut` | For sessions: `ouverte` \| `fermee` |

### `POST /api/v1/caisse/ouverture`

Opens a caisse session (required before factures / paiements vente). **Payload**

```json
{
  "montant": 500000,
  "notes": "Ouverture journée",
  "caisse_id": 1
}
```

Returns `session` with `id`, `montantOuverture`, `dateOuverture`, `statut: "ouverte"`.

### `POST /api/v1/caisse/fermeture`

Closes the current open session. **Payload**

```json
{
  "montant": 520000,
  "notes": "Fermeture journée",
  "caisse_id": 1
}
```

`montant` = physical cash counted. The API compares it to the theoretical balance, records any `ecart` as an ajustement movement, and closes the session.

### `POST /api/v1/caisse/session`

Returns the **current open session** (or `session: null`) with its movements and totals.

**Payload** `{ "caisse_id": 1 }` (optional)

### `POST /api/v1/caisse/sessions/search`

**Payload**

```json
{
  "page": 1,
  "limit": 20,
  "statut": "fermee",
  "date_from": "2026-01-01",
  "date_to": "2026-12-31",
  "caisse_id": 1,
  "user_ouverture_id": 2
}
```

Dates are optional. When both are set, returns sessions that **overlap** the period (opened before `date_to` and closed after `date_from`, or still open).

### `POST /api/v1/caisse/sessions/get-by-criteria`

Paged list of all caisse sessions in a date range. **`date_from` and `date_to` are required.**

```json
{
  "page": 1,
  "limit": 20,
  "date_from": "2026-01-01",
  "date_to": "2026-12-31",
  "statut": "fermee",
  "caisse_id": 1,
  "user_ouverture_id": 2
}
```

**Response `200`**

```json
{
  "data": {
    "sessions": [ ],
    "caisse": { "id": 1, "nom": "Caisse principale", "soldeActuel": 1250000 }
  },
  "meta": { "total": 42, "page": 1, "limit": 20, "lastPage": 3 }
}
```

### `POST /api/v1/caisse/sessions/show`

**Payload** `{ "id": 1 }` — session detail with all movements linked to that session.

**Caisse session rules**

- A **facture**, **conversion devis → facture**, **retour**, or **paiement vente** is rejected with `422` if no session is open.
- **Devis** can still be created without opening the caisse.
- `GET /caisse/solde` includes `sessionOuverte` when a session is active.

---

## Dépenses

Auth + `X-Point-De-Vente-Id`.

### `POST /api/v1/depenses/search`

**Payload**

```json
{
  "page": 1,
  "limit": 20,
  "categorie": "transport",
  "date_from": "2026-01-01",
  "date_to": "2026-12-31",
  "caisse_id": 1,
  "search": "carburant"
}
```

| `categorie` | `transport` \| `fournitures` \| `salaire` \| `loyer` \| `autre` |

### `POST /api/v1/depenses/show`

**Payload** `{ "id": 1 }`

### `POST /api/v1/depenses/create`

**Payload**

```json
{
  "libelle": "Carburant livraison",
  "categorie": "transport",
  "montant": 25000,
  "date_depense": "2026-06-10",
  "caisse_id": 1,
  "notes": ""
}
```

Creates caisse sortie automatically.

### `POST /api/v1/depenses/update`

Admin only.

### `POST /api/v1/depenses/delete`

Admin only. **Payload** `{ "id": 1 }`

---

## Stock

Auth + `X-Point-De-Vente-Id`.

### `POST /api/v1/stock/search`

**Payload** — same filters as `produits/search` + `valeurStock` per line.

### `POST /api/v1/stock/mouvements/search`

**Payload**

```json
{
  "page": 1,
  "limit": 20,
  "produit_id": 1,
  "type": "entree",
  "motif": "achat",
  "date_from": "2026-01-01",
  "date_to": "2026-12-31"
}
```

### `GET /api/v1/stock/valorisation`

**Response `200`**

```json
{
  "data": {
    "totalValeur": 5420000,
    "parCategorie": [
      { "categorieId": 1, "categorieNom": "Alimentation", "valeur": 3200000 }
    ]
  }
}
```

### `POST /api/v1/stock/alertes`

**Payload** `{ "page": 1, "limit": 20 }`

---

## Rapports

Auth + `X-Point-De-Vente-Id`. Roles: admin, gestionnaire, lecteur.

### `POST /api/v1/rapports/caisse`

**Payload**

```json
{
  "date_from": "2026-06-01",
  "date_to": "2026-06-30",
  "caisse_id": 1,
  "group_by": "jour"
}
```

| `group_by` | `jour` \| `semaine` \| `mois` |

### `POST /api/v1/rapports/stock-actuel`

**Payload** — filters like produits search.

### `POST /api/v1/rapports/valeur-stock`

**Payload**

```json
{
  "date_from": "2026-01-01",
  "date_to": "2026-06-30",
  "categorie_id": 1
}
```

### `POST /api/v1/rapports/balance-clients`

**Payload** `{ "page": 1, "limit": 20, "client_id": 1, "search": "dupont" }`

### `POST /api/v1/rapports/releve-client`

**Payload**

```json
{
  "client_id": 1,
  "date_from": "2026-01-01",
  "date_to": "2026-06-30"
}
```

---

## Roles & permissions

| Permission | Roles |
|------------|-------|
| `users`, `points_de_vente` | admin |
| `clients`, `fournisseurs`, `categories`, `produits`, `ventes`, `achats`, `caisse`, `depenses`, `stock`, `reglements` | admin, gestionnaire, caissier*, lecteur* |
| `*_write` | admin, gestionnaire (+ caissier for ventes, depenses, reglements) |
| `ventes_retour` | admin |
| `caisse_admin`, `depenses_admin` | admin |
| `rapports_full` | admin, gestionnaire, lecteur |

\* caissier: no lecteur on fournisseurs; limited rapports.

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
| POST | `/api/v1/users/search` |
| POST | `/api/v1/users/show` |
| POST | `/api/v1/users/create` |
| POST | `/api/v1/users/update` |
| POST | `/api/v1/users/deactivate` |
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

---

## Security notes

| Topic | Behaviour |
|-------|-----------|
| Auth | Bearer access tokens only (`Authorization` header). No public self-signup — users are created by admin via `/users/create`. |
| CSRF | Disabled (`config/shield.ts`) — not required for token-based API clients. |
| Rate limiting | Login only (`POST /auth/login`). Production: `LIMITER_STORE=database`. |
| Dependencies | `mysql2` declared in `package.json` (MySQL driver). |
| Tests | `.env.test` uses `DB_DATABASE=gestio_test` and `LIMITER_STORE=memory` (isolated from dev/prod data). |
