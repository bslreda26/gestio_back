import type Vente from '#models/vente'

export function serializeVenteForApi(
  vente: Vente,
  options: { includeMarge?: boolean; includeMargePct?: boolean } = {}
) {
  const data = vente.serialize() as Record<string, unknown>

  if (options.includeMarge) {
    data.marge = Number(vente.marge)
  } else {
    delete data.marge
  }

  if (options.includeMargePct) {
    data.margePct = Number(vente.margePct)
  } else {
    delete data.margePct
  }

  return data
}
