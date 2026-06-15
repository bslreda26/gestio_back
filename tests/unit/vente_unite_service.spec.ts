import { test } from '@japa/runner'
import {
  AjustementQuantiteError,
  convertPricingWhenEnablingDetailConfig,
  convertStockWhenEnablingDetailConfig,
  formatStockLabel,
  fromPrixAchatGros,
  fromProduitPrixStockage,
  hasUniteDetailConfig,
  normalizeProduitUniteFields,
  resolveAjustementQuantite,
  resolvePlancherLigne,
  resolveStockDisplay,
  toPlancherAffichage,
  toPlancherStockage,
  toProduitPrixAffichage,
  toProduitPrixStockage,
  toPrixAchatGros,
  toStockQuantite,
} from '#services/vente_unite_service'

const produitSacKg = {
  unite: 'kg',
  uniteGros: 'sac',
  contenance: 50,
  venteAuDetail: true,
}

const produitSacKgSansDetail = {
  ...produitSacKg,
  venteAuDetail: false,
}

const produitPiece = {
  unite: 'unité',
  uniteGros: 'pièce',
  contenance: 1,
  venteAuDetail: false,
}

const produitGrosSimple = {
  unite: 'pièce',
  uniteGros: null as string | null,
  contenance: 1,
  venteAuDetail: false,
}

test.group('vente_unite_service — stock display', () => {
  test('simple gros product shows plain stock count without unit', ({ assert }) => {
    const display = resolveStockDisplay(produitGrosSimple, 12)
    assert.equal(display.stockDetail, 12)
    assert.equal(display.stockPieces, 12)
    assert.equal(display.stockLabel, '12')
    assert.isFalse(display.venteAuDetail)
  })

  test('simple gros product with optional label shows unit suffix', ({ assert }) => {
    const display = resolveStockDisplay(produitPiece, 12)
    assert.equal(display.stockLabel, '12 pièce')
  })

  test('detail product shows pieces and remainder', ({ assert }) => {
    const display = resolveStockDisplay(produitSacKg, 249)
    assert.equal(display.stockPieces, 4)
    assert.equal(display.stockResteDetail, 49)
    assert.equal(display.stockLabel, '4 sac + 49 kg')
  })

  test('detail product without vente au detail shows pieces only when no remainder', ({
    assert,
  }) => {
    const display = resolveStockDisplay(produitSacKgSansDetail, 200)
    assert.equal(display.stockLabel, '4 sac')
  })

  test('formatStockLabel shows remainder when vente au detail closed but stock has reliquat', ({
    assert,
  }) => {
    assert.equal(formatStockLabel(produitSacKgSansDetail, 249, false), '4 sac + 49 kg')
    assert.equal(formatStockLabel(produitSacKgSansDetail, 200, false), '4 sac')
  })

  test('toStockQuantite multiplies piece by contenance', ({ assert }) => {
    assert.equal(toStockQuantite('piece', 2, produitSacKg), 100)
    assert.equal(toStockQuantite('detail', 25, produitSacKg), 25)
  })
})

test.group('vente_unite_service — ajustement', () => {
  test('pieces + detail when vente au detail is open', ({ assert }) => {
    assert.equal(
      resolveAjustementQuantite(produitSacKg, { quantite_pieces: 2, quantite_detail: 25 }),
      125
    )
  })

  test('pieces only when vente au detail is closed', ({ assert }) => {
    assert.equal(
      resolveAjustementQuantite(produitSacKgSansDetail, { quantite_pieces: 3 }),
      150
    )
  })

  test('rejects detail adjustment when vente au detail is closed', ({ assert }) => {
    assert.throws(
      () =>
        resolveAjustementQuantite(produitSacKgSansDetail, {
          quantite_pieces: 1,
          quantite_detail: 10,
        }),
      AjustementQuantiteError
    )
  })

  test('rejects detail quantity greater than or equal to contenance', ({ assert }) => {
    assert.throws(
      () =>
        resolveAjustementQuantite(produitSacKg, { quantite_pieces: 0, quantite_detail: 50 }),
      AjustementQuantiteError
    )
  })
})

test.group('vente_unite_service — achat pricing', () => {
  test('achat stock is 1:1 for simple gros product', ({ assert }) => {
    assert.isFalse(hasUniteDetailConfig(produitGrosSimple))
    assert.equal(toStockQuantite('piece', 3, produitGrosSimple), 3)
  })

  test('normalize clears vente au detail when unit config incomplete', ({ assert }) => {
    const normalized = normalizeProduitUniteFields({
      unite: 'kg',
      unite_gros: 'sac',
      contenance: undefined,
      vente_au_detail: true,
    })
    assert.isFalse(normalized.venteDetailDisponible)
    assert.isFalse(normalized.venteAuDetail)
    assert.equal(normalized.contenance, 1)
  })

  test('normalize keeps vente au detail when all unit fields set', ({ assert }) => {
    const normalized = normalizeProduitUniteFields({
      unite: 'kg',
      unite_gros: 'sac',
      contenance: 50,
      vente_au_detail: true,
    })
    assert.isTrue(normalized.venteDetailDisponible)
    assert.isTrue(normalized.venteAuDetail)
    assert.equal(normalized.contenance, 50)
  })

  test('normalizes detail line price to gros and back', ({ assert }) => {
    const gros = toPrixAchatGros(200, 10, 'detail', produitSacKg)
    assert.equal(gros.prixUnitaireHt, 10000)
    assert.equal(gros.frais, 500)

    const ligne = fromPrixAchatGros(10000, 500, 'piece', produitSacKg)
    assert.equal(ligne.prixUnitaireHt, 10000)
    assert.equal(ligne.frais, 500)

    const detail = fromPrixAchatGros(10000, 500, 'detail', produitSacKg)
    assert.equal(detail.prixUnitaireHt, 200)
    assert.equal(detail.frais, 10)
  })

  test('converts stock when enabling gros+detail config', ({ assert }) => {
    const before = { unite: 'kg', uniteGros: null as string | null, contenance: 1 }
    const after = { unite: 'kg', uniteGros: 'sac', contenance: 50 }
    assert.equal(convertStockWhenEnablingDetailConfig(35, before, after), 1750)
    assert.equal(convertStockWhenEnablingDetailConfig(0, before, after), 0)
    assert.equal(convertStockWhenEnablingDetailConfig(35, after, after), 35)
  })

  test('converts stock when disabling gros+detail config (contenance cleared)', ({ assert }) => {
    const before = { unite: 'kg', uniteGros: 'sac', contenance: 50 }
    const after = { unite: 'kg', uniteGros: 'sac', contenance: 1 }
    assert.equal(convertStockWhenEnablingDetailConfig(1980, before, after), 39.6)
    assert.equal(convertStockWhenEnablingDetailConfig(200, before, after), 4)
  })

  test('stores gros input per detail unit internally', ({ assert }) => {
    const stockage = toProduitPrixStockage(44050, 500, produitSacKg)
    assert.equal(stockage.prixAchatHt, 881)
    assert.equal(stockage.frais, 10)

    const affichage = toProduitPrixAffichage(881, 10, produitSacKg)
    assert.equal(affichage.prixAchatHtGros, 44050)
    assert.equal(affichage.fraisGros, 500)
  })

  test('converts pricing when enabling gros+detail config', ({ assert }) => {
    const before = { unite: 'kg', uniteGros: null as string | null, contenance: 1 }
    const after = { unite: 'kg', uniteGros: 'sac', contenance: 50 }
    const converted = convertPricingWhenEnablingDetailConfig(10000, 500, 10500, before, after)
    assert.equal(converted.prixAchatHt, 200)
    assert.equal(converted.frais, 10)
    assert.equal(converted.plancher, 210)
  })

  test('converts pricing when disabling gros+detail config', ({ assert }) => {
    const before = { unite: 'kg', uniteGros: 'sac', contenance: 50 }
    const after = { unite: 'kg', uniteGros: 'sac', contenance: 1 }
    const converted = convertPricingWhenEnablingDetailConfig(200, 10, 210, before, after)
    assert.equal(converted.prixAchatHt, 10000)
    assert.equal(converted.frais, 500)
    assert.equal(converted.plancher, 10500)
  })

  test('resolvePlancherLigne uses detail storage and gros sale unit', ({ assert }) => {
    const produit = { ...produitSacKg, plancher: 881 }
    assert.equal(resolvePlancherLigne(produit, 'detail'), 881)
    assert.equal(resolvePlancherLigne(produit, 'piece'), 44050)
    assert.equal(toPlancherAffichage(881, produitSacKg), 44050)
    assert.equal(toPlancherStockage(44050, produitSacKg), 881)
  })

  test('catalogue prix exposes detail and gros when contenance configured', ({ assert }) => {
    const catalogue = fromProduitPrixStockage({
      prixAchatHt: '881',
      prixAchatTtc: '881',
      frais: '10',
      plancher: '891',
      ...produitSacKg,
    })
    assert.equal(catalogue.mode, 'detail')
    if (catalogue.mode !== 'detail') return
    assert.equal(catalogue.moyenneAchatHtDetail, 881)
    assert.equal(catalogue.moyenneAchatHtGros, 44050)
    assert.equal(catalogue.plancherDetail, 891)
    assert.equal(catalogue.plancherGros, 44550)
  })

  test('catalogue prix stays gros when no contenance', ({ assert }) => {
    const catalogue = fromProduitPrixStockage({
      prixAchatHt: '10000',
      prixAchatTtc: '11800',
      frais: '500',
      plancher: '12300',
      ...produitGrosSimple,
    })
    assert.equal(catalogue.mode, 'gros')
    if (catalogue.mode !== 'gros') return
    assert.equal(catalogue.plancher, 12300)
  })
})
