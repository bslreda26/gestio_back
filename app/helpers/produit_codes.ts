import Produit from '#models/produit'

export async function loadProduitCodeMap(produitIds: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(produitIds.filter((id) => id > 0))]
  if (unique.length === 0) return new Map()

  const produits = await Produit.query().whereIn('id', unique).select('id', 'code')
  return new Map(produits.map((p) => [p.id, p.code]))
}
