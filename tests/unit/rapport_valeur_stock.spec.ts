import { serializeValeurStockPlancher } from '#services/rapport_service'
import { test } from '@japa/runner'

test.group('rapport valeur-stock plancher', () => {
  test('exposes detail and gros plancher for produits with contenance', ({ assert }) => {
    const fields = serializeValeurStockPlancher({
      plancher: '301',
      contenance: '50',
      unite: 'kg',
      uniteGros: 'sac',
      prixAchatHt: '100',
      prixAchatTtc: '118',
      frais: '10',
    })

    assert.equal(fields.prixUniteStockage, 'detail')
    assert.equal(fields.plancher, 301)
    assert.equal(fields.plancherDetail, 301)
    assert.equal(fields.plancherGros, 15_050)
    assert.equal(fields.plancherUnite, 'kg')
    assert.equal(fields.uniteGros, 'sac')
    assert.equal(fields.contenance, 50)
  })

  test('keeps single plancher for simple gros produit', ({ assert }) => {
    const fields = serializeValeurStockPlancher({
      plancher: '500',
      contenance: '1',
      unite: null,
      uniteGros: 'pièce',
      prixAchatHt: '400',
      prixAchatTtc: '472',
      frais: '0',
    })

    assert.equal(fields.prixUniteStockage, 'gros')
    assert.equal(fields.plancher, 500)
    assert.equal(fields.plancherUnite, 'pièce')
    assert.isUndefined(fields.plancherDetail)
    assert.isUndefined(fields.plancherGros)
  })
})
