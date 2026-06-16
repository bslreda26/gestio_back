# ERP / POS — Certifier une facture (sans import)

Ce guide explique comment intégrer la **certification FNE** dans votre application ERP/POS lorsque vous avez déjà les tables `factures` et `lignes`. Vous n’avez **pas** besoin des endpoints d’import (`/api/uploadFacturesV4`, `/api/uploadJson`, etc.).

---

## 1. Principe

```
┌──────────────┐    INSERT      ┌──────────────┐    POST /api/certifier…    ┌──────────────┐    POST sign    ┌──────────────┐
│  Votre POS   │ ─────────────► │  SQL Server  │ ◄───────────────────────── │ FNE Backend  │ ──────────────► │ Plateforme   │
│  (ERP)       │  factures +    │  factures    │   lit facture + lignes     │ (ce projet)  │                 │ FNE          │
│              │  lignes        │  lignes      │   construit le payload     │              │                 │              │
└──────────────┘                └──────────────┘                            └──────────────┘                 └──────────────┘
```

**Votre ERP fait 2 choses :**

1. **À la vente** — insérer la facture et ses lignes dans `factures` et `lignes`.
2. **À la certification** — appeler une seule route API du backend avec l’ID ou le numéro de pièce.

Le backend lit la base, envoie la facture à la FNE, puis met à jour `normalise`, `apiResponse` et `testNormalise`.

---

## 2. Données à insérer depuis le POS

### 2.1 Table `factures`

| Colonne | Obligatoire | Description | Exemple |
|---------|-------------|-------------|---------|
| `numeroPieceSage` | Oui | Numéro unique de la facture | `"FACT001"` |
| `numeroPiecePointVente` | Oui | Numéro côté point de vente (unique) | `"PV01-FACT001"` |
| `pointDeVenteID` | Oui | FK vers `point_de_ventes.id` | `1` |
| `user_id` | Oui | FK vers `users.id` | `1` |
| `dateSage` | Oui | Date de la facture | `2024-01-15` |
| `totalTTC` | Oui | Montant TTC | `1190.00` |
| `totalHT` | Oui | Montant HT | `1000.00` |
| `totalTVA` | Oui | Montant TVA | `190.00` |
| `numerTiersSage` | Oui | Code client / tiers | `"CLI001"` |
| `clientCompanyName` | Oui | Nom du client | `"Société ABC"` |
| `template` | Oui | `B2B` ou `B2C` | `"B2B"` |
| `type` | Oui | `sales` (vente) ou `refund` (avoir) | `"sales"` |
| `normalise` | Oui | Toujours `false` avant certification | `false` |
| `excluded` | Oui | `false` pour pouvoir certifier | `false` |
| `clientNcc` | Recommandé (B2B) | NCC du client | `"123456789"` |
| `clientEmail` | Optionnel | Email client | `"client@ex.com"` |
| `clientPhone` | Optionnel | Téléphone | `"+225..."` |
| `paymentMethod` | Optionnel | `cash` ou `deferred` (défaut backend: `deferred`) | `"deferred"` |
| `commercialMessage` | Optionnel | Message commercial | `"Merci"` |
| `discount` | Optionnel | Remise globale | `0` |

### 2.2 Table `lignes` (au moins 1 ligne par facture)

| Colonne | Obligatoire | Description | Exemple |
|---------|-------------|-------------|---------|
| `factureID` | Oui | FK vers `factures.id` | `123` |
| `reference` | Oui | Référence article | `"PROD001"` |
| `description` | Oui | Libellé | `"Produit 1"` |
| `quantity` | Oui | Quantité | `2` |
| `amount` | Oui | Prix unitaire HT | `500.00` |
| `nomTva` | Oui | Type TVA FNE | `"TVA"`, `"TVAB"`, `"TVAC"` |
| `tauxTva` | Oui | Taux TVA (%) | `18` |
| `discount` | Oui | Remise ligne (%) | `0` |
| `numeroPieceSage` | Oui | Même numéro que la facture | `"FACT001"` |
| `numeroFacture` | Oui | Même numéro que la facture | `"FACT001"` |
| `remiseSage` | Oui | Remise Sage | `0` |
| `typeRemise` | Oui | Type remise | `0` |
| `totalTTC` | Oui | Total TTC de la ligne | `1180.00` |
| `tauxTaxe2` | Optionnel | Taxe AIRSI (montant) | `0` |

### 2.3 Dépendances

| Table | Rôle |
|-------|------|
| `point_de_ventes` | `pointOfSale` et `establishment` envoyés à la FNE |
| `apikeys` | Clé API FNE (`key`) et URL (`prodURL`) |
| `users` | Compte pour se connecter à l’API |

---

## 3. Fonction de certification dans votre ERP

### 3.1 Endpoints à utiliser

| Cas | Endpoint | Quand l’utiliser |
|-----|----------|------------------|
| Vous avez `factures.id` | `POST /api/certifierFactureParID` | Recommandé si le POS enregistre l’ID retourné par SQL |
| Vous avez le numéro pièce | `POST /api/certifierFactureParNumero` | Si vous ne connaissez que `numeroPieceSage` |

**Ne pas utiliser** pour une simple certification : `/api/uploadFacturesV4`, `/api/uploadJson`, `/api/uploadEnteteFactureCommercial`.

### 3.2 Authentification (obligatoire avant chaque session)

```http
POST /api/login
Content-Type: application/json

{
  "username": "votre_utilisateur",
  "password": "votre_mot_de_passe"
}
```

- Réponse : cookie de session (pas de token JWT).
- Toutes les requêtes suivantes doivent **renvoyer ce cookie**.
- En navigateur : `credentials: 'include'`.
- En serveur (C#, Java, etc.) : conserver le cookie dans un jar / `HttpClient` avec `CookieContainer`.

---

## 4. Request — ce que votre ERP envoie au backend

### Option A — Par ID (recommandé)

```http
POST /api/certifierFactureParID
Content-Type: application/json
Cookie: <session cookie>

{
  "factureID": 123
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `factureID` | `number` | `factures.id` de la facture à certifier |

### Option B — Par numéro de pièce

```http
POST /api/certifierFactureParNumero
Content-Type: application/json
Cookie: <session cookie>

{
  "numeroPiece": "FACT001"
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `numeroPiece` | `string` | Valeur de `factures.numeroPieceSage` |

> **Important :** votre ERP n’envoie **pas** les lignes ni les montants à la certification. Le backend les lit dans `lignes` via `factureID`.

---

## 5. Response — ce que le backend renvoie à votre ERP

### 5.1 Succès — `certifierFactureParNumero` (HTTP 200)

```json
{
  "message": "Facture certifiée avec succès",
  "facture": {
    "id": 123,
    "numeroPieceSage": "FACT001",
    "numeroPiecePointVente": "PV01-FACT001",
    "totalTTC": 1190,
    "totalHT": 1000,
    "totalTVA": 190,
    "clientCompanyName": "Société ABC",
    "clientNcc": "123456789",
    "template": "B2B",
    "normalise": true,
    "testNormalise": false,
    "excluded": false,
    "apiResponse": "{\"statusCode\":200,\"invoice\":{...}}"
  }
}
```

### 5.2 Succès — `certifierFactureParID` (HTTP 200)

Retourne directement l’objet `facture` (sans wrapper `message`) :

```json
{
  "id": 123,
  "numeroPieceSage": "FACT001",
  "normalise": true,
  "testNormalise": false,
  "apiResponse": "{\"statusCode\":200,\"invoice\":{...}}",
  ...
}
```

### 5.3 Échec (HTTP 500)

```json
{
  "message": "Erreur lors de la certification de la facture",
  "error": "Cette facture ne peut pas être certifiée"
}
```

Ou si la FNE a refusé : HTTP 500 avec `error: "La facture n'a pas été certifiée"` et `normalise: false` en base.

### 5.4 Champs à lire dans votre ERP après certification

| Champ | Signification | Action ERP |
|-------|---------------|------------|
| `normalise` | `true` = certification OK | Marquer la facture comme certifiée |
| `testNormalise` | `true` si FNE a renvoyé `statusCode: 500` | Afficher un avertissement |
| `apiResponse` | JSON string de la réponse FNE | Parser pour QR code, numéro FNE, etc. |

### 5.5 Contenu typique de `apiResponse` (réponse FNE)

`apiResponse` est une **chaîne JSON**. Après `JSON.parse(apiResponse)` :

```json
{
  "statusCode": 200,
  "invoice": {
    "id": "uuid-fne-de-la-facture",
    "items": [
      {
        "id": "uuid-ligne-fne",
        "reference": "PROD001",
        "quantity": 2,
        "description": "Produit 1"
      }
    ]
  }
}
```

Utilisez `invoice.id` et `invoice.items[].id` si vous devez certifier des **avoirs** plus tard.

En cas d’erreur FNE, `apiResponse` contient le message d’erreur de la plateforme (souvent avec `statusCode`).

---

## 6. Payload FNE — ce que le backend construit automatiquement

Vous **n’envoyez pas** ce JSON depuis l’ERP. Il est utile pour **valider vos données** avant certification.

Le backend mappe `factures` + `lignes` → `POST {prodURL}/external/invoices/sign` :

```json
{
  "amount": 1190.00,
  "clientCompanyName": "Société ABC",
  "clientEmail": "client@ex.com",
  "clientNcc": "123456789",
  "clientPhone": "+225...",
  "invoiceType": "sale",
  "items": [
    {
      "quantity": 2,
      "reference": "PROD001",
      "description": "Produit 1",
      "discount": 0,
      "amount": 500.00,
      "taxes": ["TVA"],
      "customTaxes": []
    }
  ],
  "paymentMethod": "deferred",
  "vatAmount": 190.00,
  "isRne": false,
  "template": "B2B",
  "pointOfSale": "nom-du-pdv",
  "establishment": "nom-etablissement",
  "discount": 0,
  "date": "2024-01-15",
  "commercialMessage": "ref: FACT001 Merci"
}
```

### Mapping factures → payload FNE

| Colonne `factures` | Champ FNE |
|--------------------|-----------|
| `totalTTC` | `amount` |
| `clientCompanyName` | `clientCompanyName` |
| `clientEmail` | `clientEmail` |
| `clientNcc` | `clientNcc` |
| `clientPhone` | `clientPhone` |
| `totalTVA` | `vatAmount` |
| `template` | `template` |
| `discount` | `discount` |
| `dateSage` | `date` |
| `paymentMethod` | `paymentMethod` |
| `numeroPieceSage` + `commercialMessage` | `commercialMessage` |
| `point_de_ventes.pointOfSale` | `pointOfSale` |
| `point_de_ventes.establishment` | `establishment` |
| — | `invoiceType` = toujours `"sale"` |
| — | `isRne` = toujours `false` |

### Mapping lignes → `items[]`

| Colonne `lignes` | Champ FNE |
|------------------|-----------|
| `quantity` | `quantity` |
| `reference` | `reference` |
| `description` | `description` |
| `discount` | `discount` |
| `amount` | `amount` (prix unitaire HT) |
| `nomTva` | `taxes[0]` |
| `tauxTaxe2` (> 0) | `customTaxes` → `{ "name": "AIRSI", "amount": ... }` |

### Cas particulier — timbre

Si une ligne a la même `reference` que le timbre configuré pour le point de vente :

- Cette ligne est **exclue** du payload FNE.
- `paymentMethod` devient `"cash"`.

---

## 7. Exemple de fonction ERP (pseudo-code)

```javascript
const BASE_URL = 'http://localhost:3333'  // URL du FNE Backend

async function certifierFactureDepuisPOS(factureID) {
  // 1. Login (une fois par session)
  await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username: 'user', password: 'pass' }),
  })

  // 2. Certifier
  const res = await fetch(`${BASE_URL}/api/certifierFactureParID`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ factureID }),
  })

  const facture = await res.json()

  if (!res.ok || !facture.normalise) {
    const fneError = facture.apiResponse ? JSON.parse(facture.apiResponse) : null
    throw new Error(fneError?.message || facture.error || 'Certification échouée')
  }

  // 3. Extraire les infos FNE
  const fne = JSON.parse(facture.apiResponse)
  return {
    factureID: facture.id,
    numeroPiece: facture.numeroPieceSage,
    fneInvoiceId: fne.invoice?.id,
    certified: true,
  }
}
```

### Flux complet au POS

```
1. Vente terminée
2. INSERT factures (normalise = false, excluded = false)
3. INSERT lignes (factureID = id retourné)
4. Appeler certifierFactureDepuisPOS(factureID)
5. Si normalise === true → afficher QR / imprimer ticket certifié
6. Sinon → afficher erreur depuis apiResponse
```

---

## 8. Exemple cURL

```bash
# Login
curl -c cookies.txt -X POST http://localhost:3333/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}'

# Certifier par ID
curl -b cookies.txt -X POST http://localhost:3333/api/certifierFactureParID \
  -H "Content-Type: application/json" \
  -d '{"factureID": 123}'

# Certifier par numéro
curl -b cookies.txt -X POST http://localhost:3333/api/certifierFactureParNumero \
  -H "Content-Type: application/json" \
  -d '{"numeroPiece": "FACT001"}'
```

---

## 9. Erreurs fréquentes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Configuration non trouvée` | `apikeys` vide | Configurer `key` et `prodURL` |
| `Cette facture ne peut pas être certifiée` | `excluded = true` | Mettre `excluded = false` |
| HTTP 401 | Session expirée | Refaire `/api/login` |
| `normalise` reste `false` | FNE a rejeté | Lire `apiResponse` |
| Facture introuvable | Mauvais `factureID` ou `numeroPiece` | Vérifier les données POS |
| Pas de lignes | `lignes` vide | Insérer au moins 1 ligne |

---

## 10. Checklist avant certification

- [ ] Facture insérée dans `factures` avec `normalise = false` et `excluded = false`
- [ ] Au moins une ligne dans `lignes` liée par `factureID`
- [ ] `pointDeVenteID` pointe vers un `point_de_ventes` valide
- [ ] `template` = `B2B` ou `B2C`
- [ ] Totaux `totalHT`, `totalTVA`, `totalTTC` cohérents avec les lignes
- [ ] `apikeys` configuré (clé FNE + URL production)
- [ ] Utilisateur ERP connecté via `/api/login`

---

## 11. Fichiers source du backend

| Fichier | Rôle |
|---------|------|
| `start/routes.ts` | Routes API |
| `app/controllers/factures_controller.ts` | Handlers HTTP |
| `app/services/facture_service.ts` | Logique `certifierFactureParID`, `certifierFactureParNumero` |
| `app/models/DTO/FactureCertifDTO.ts` | Structure du payload FNE |
| `app/models/facture.ts` | Modèle `factures` |
| `app/models/ligne.ts` | Modèle `lignes` |

---

## Résumé

| Étape | Qui | Quoi |
|-------|-----|------|
| Vente | Votre ERP | `INSERT` dans `factures` + `lignes` |
| Certification | Votre ERP → Backend | `POST /api/certifierFactureParID` avec `{ "factureID": 123 }` |
| Envoi FNE | Backend → FNE | Payload construit depuis la base |
| Résultat | Backend → Votre ERP | `facture.normalise` + `facture.apiResponse` |

Votre fonction ERP ne fait qu’**un appel API minimal** ; toute la logique métier FNE est dans ce backend.
