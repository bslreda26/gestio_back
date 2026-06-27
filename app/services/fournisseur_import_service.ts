import Fournisseur from '#models/fournisseur'
import { pickString, validateRequiredFields } from '#helpers/excel_import'
import type { ImportSummary } from '#types/import_result'
import { emptyImportSummary } from '#types/import_result'

const FIELD_ALIASES = {
  nom: ['nom', 'name', 'raison_sociale', 'fournisseur', 'libelle', 'designation'],
  code: ['code', 'ref', 'reference', 'code_fournisseur'],
  email: ['email', 'mail', 'e_mail'],
  telephone: ['telephone', 'tel', 'phone', 'mobile'],
  adresse: ['adresse', 'address'],
  ville: ['ville', 'city'],
  pays: ['pays', 'country'],
  contact_nom: ['contact_nom', 'contact', 'nom_contact', 'interlocuteur'],
  notes: ['notes', 'note', 'commentaire', 'observations'],
} as const

const REQUIRED_FIELDS = [
  { field: 'code', aliases: [...FIELD_ALIASES.code], message: 'Code obligatoire' },
  { field: 'nom', aliases: [...FIELD_ALIASES.nom], message: 'Nom obligatoire' },
] as const

export async function importFournisseursFromRows(
  rows: Record<string, unknown>[],
  options: { updateExisting: boolean }
): Promise<ImportSummary> {
  const summary = emptyImportSummary()
  summary.total_rows = rows.length

  for (let index = 0; index < rows.length; index++) {
    const rowNumber = index + 2
    const row = rows[index]

    const requiredErrors = validateRequiredFields(row, rowNumber, [...REQUIRED_FIELDS])
    if (requiredErrors.length > 0) {
      summary.errors.push(...requiredErrors)
      summary.skipped++
      continue
    }

    const code = pickString(row, [...FIELD_ALIASES.code])!
    const nom = pickString(row, [...FIELD_ALIASES.nom])!

    try {
      const fournisseur = await Fournisseur.query().where('code', code).first()

      if (fournisseur) {
        if (!options.updateExisting) {
          summary.skipped++
          continue
        }

        fournisseur.merge({
          nom,
          email: pickString(row, [...FIELD_ALIASES.email]) ?? fournisseur.email,
          telephone: pickString(row, [...FIELD_ALIASES.telephone]) ?? fournisseur.telephone,
          adresse: pickString(row, [...FIELD_ALIASES.adresse]) ?? fournisseur.adresse,
          ville: pickString(row, [...FIELD_ALIASES.ville]) ?? fournisseur.ville,
          pays: pickString(row, [...FIELD_ALIASES.pays]) ?? fournisseur.pays,
          contactNom: pickString(row, [...FIELD_ALIASES.contact_nom]) ?? fournisseur.contactNom,
          notes: pickString(row, [...FIELD_ALIASES.notes]) ?? fournisseur.notes,
        })
        await fournisseur.save()
        summary.updated++
        continue
      }

      await Fournisseur.create({
        code,
        nom,
        email: pickString(row, [...FIELD_ALIASES.email]) ?? null,
        telephone: pickString(row, [...FIELD_ALIASES.telephone]) ?? null,
        adresse: pickString(row, [...FIELD_ALIASES.adresse]) ?? null,
        ville: pickString(row, [...FIELD_ALIASES.ville]) ?? null,
        pays: pickString(row, [...FIELD_ALIASES.pays]) ?? null,
        contactNom: pickString(row, [...FIELD_ALIASES.contact_nom]) ?? null,
        solde: '0',
        notes: pickString(row, [...FIELD_ALIASES.notes]) ?? null,
        isActive: true,
      })
      summary.created++
    } catch (error) {
      summary.errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      })
      summary.skipped++
    }
  }

  return summary
}
