import Fournisseur from '#models/fournisseur'
import type Achat from '#models/achat'

export async function serializeAchatsForList(achats: Achat[]) {
  if (achats.length === 0) return []

  const fournisseurIds = [...new Set(achats.map((a) => a.fournisseurId))]
  const fournisseurs = await Fournisseur.query()
    .whereIn('id', fournisseurIds)
    .select('id', 'nom', 'code')
  const fournisseurById = new Map(fournisseurs.map((f) => [f.id, f]))

  return achats.map((achat) => {
    const fournisseur = fournisseurById.get(achat.fournisseurId)
    return {
      ...achat.serialize(),
      fournisseur: fournisseur ? { id: fournisseur.id, nom: fournisseur.nom, code: fournisseur.code } : null,
      fournisseurNom: fournisseur?.nom ?? null,
    }
  })
}
