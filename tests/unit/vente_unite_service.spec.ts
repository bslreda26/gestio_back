import { test } from '@japa/runner'
import {
  AjustementQuantiteError,
  formatStockLabel,
  resolveAjustementQuantite,
  resolveStockDisplay,
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

test.group('vente_unite_service — stock display', () => {
  test('shows pieces and detail remainder when vente au detail is open', ({ assert }) => {
    const display = resolveStockDisplay(produitSacKg, 249)
    assert.equal(display.stockPieces, 4)
    assert.equal(display.stockResteDetail, 49)
    assert.equal(display.stockLabel, '4 sac + 49 kg')
    assert.isTrue(display.venteAuDetail)
  })

  test('shows pieces only when vente au detail is closed', ({ assert }) => {
    const display = resolveStockDisplay(produitSacKgSansDetail, 249)
    assert.equal(display.stockPieces, 4)
    assert.equal(display.stockResteDetail, 0)
    assert.equal(display.stockLabel, '4 sac')
  })

  test('formatStockLabel with single unit product', ({ assert }) => {
    assert.equal(formatStockLabel(produitPiece, 12), '12 pièce')
  })
})

test.group('vente_unite_service — ajustement quantite', () => {
  test('converts pieces and detail to stock quantity', ({ assert }) => {
    assert.equal(
      resolveAjustementQuantite(produitSacKg, { quantite_pieces: 5, quantite_detail: 0 }),
      250
    )
    assert.equal(
      resolveAjustementQuantite(produitSacKg, { quantite_pieces: 4, quantite_detail: 49 }),
      249
    )
  })

  test('legacy quantite in detail units still works', ({ assert }) => {
    assert.equal(resolveAjustementQuantite(produitSacKg, { quantite: 250 }), 250)
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
