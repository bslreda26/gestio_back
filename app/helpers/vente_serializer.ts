import type Vente from '#models/vente'
import type { VenteApiVisibility } from '#helpers/vente_ligne_visibility'

export type VenteSerializeOptions = Pick<
  VenteApiVisibility,
  'includeMarge' | 'includeMargePct' | 'includeRemiseTotalePct' | 'includeRemiseMontant'
>

export function serializeVenteForApi(vente: Vente, options: VenteSerializeOptions = {}) {
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

  if (options.includeRemiseTotalePct) {
    data.remisePct = Number(vente.remisePct)
  } else {
    delete data.remisePct
  }

  if (options.includeRemiseMontant) {
    data.remiseMontant = Number(vente.remiseMontant)
  } else {
    delete data.remiseMontant
  }

  return data
}
