import Client from '#models/client'
import { CLIENT_TYPES } from '#constants/client_types'
import { pickBoolean, pickNumber, pickString, validateRequiredFields } from '#helpers/excel_import'
import type { ImportSummary } from '#types/import_result'
import { emptyImportSummary } from '#types/import_result'

const FIELD_ALIASES = {
  nom: ['nom', 'name', 'raison_sociale', 'client', 'libelle', 'designation'],
  code: ['code', 'ref', 'reference', 'code_client'],
  type: ['type', 'type_client'],
  email: ['email', 'mail', 'e_mail'],
  telephone: ['telephone', 'tel', 'phone', 'mobile'],
  adresse: ['adresse', 'address'],
  ville: ['ville', 'city'],
  pays: ['pays', 'country'],
  credit_limit: ['credit_limit', 'plafond_credit', 'limite_credit', 'credit'],
  ncc: ['ncc', 'numero_cc', 'compte_contribuable'],
  exonere_tva: ['exonere_tva', 'exoneration_tva', 'tva_exonere'],
  exonere_airsi: ['exonere_airsi', 'exoneration_airsi', 'airsi_exonere'],
  notes: ['notes', 'note', 'commentaire', 'observations'],
} as const

const REQUIRED_FIELDS = [
  { field: 'code', aliases: [...FIELD_ALIASES.code], message: 'Code obligatoire' },
  { field: 'nom', aliases: [...FIELD_ALIASES.nom], message: 'Nom obligatoire' },
  { field: 'type', aliases: [...FIELD_ALIASES.type], message: 'Type obligatoire' },
] as const

function parseClientType(value: string | undefined): (typeof CLIENT_TYPES)[number] | undefined {
  if (!value) return undefined
  const upper = value.trim().toUpperCase()
  return CLIENT_TYPES.includes(upper as (typeof CLIENT_TYPES)[number])
    ? (upper as (typeof CLIENT_TYPES)[number])
    : undefined
}

export async function importClientsFromRows(
  rows: Record<string, unknown>[],
  pointDeVenteId: number,
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
    const clientType = parseClientType(pickString(row, [...FIELD_ALIASES.type]))

    if (!clientType) {
      summary.errors.push({
        row: rowNumber,
        field: 'type',
        message: `Type invalide — valeurs acceptées : ${CLIENT_TYPES.join(', ')}`,
      })
      summary.skipped++
      continue
    }

    try {
      const client = await Client.query()
        .where('point_de_vente_id', pointDeVenteId)
        .where('code', code)
        .first()

      if (client) {
        if (!options.updateExisting) {
          summary.skipped++
          continue
        }

        client.merge({
          nom,
          type: clientType,
          email: pickString(row, [...FIELD_ALIASES.email]) ?? client.email,
          telephone: pickString(row, [...FIELD_ALIASES.telephone]) ?? client.telephone,
          adresse: pickString(row, [...FIELD_ALIASES.adresse]) ?? client.adresse,
          ville: pickString(row, [...FIELD_ALIASES.ville]) ?? client.ville,
          pays: pickString(row, [...FIELD_ALIASES.pays]) ?? client.pays,
          creditLimit: String(pickNumber(row, [...FIELD_ALIASES.credit_limit]) ?? Number(client.creditLimit)),
          ncc: pickString(row, [...FIELD_ALIASES.ncc]) ?? client.ncc,
          exonereTva: pickBoolean(row, [...FIELD_ALIASES.exonere_tva]) ?? client.exonereTva,
          exonereAirsi: pickBoolean(row, [...FIELD_ALIASES.exonere_airsi]) ?? client.exonereAirsi,
          notes: pickString(row, [...FIELD_ALIASES.notes]) ?? client.notes,
        })
        await client.save()
        summary.updated++
        continue
      }

      await Client.create({
        code,
        pointDeVenteId,
        nom,
        type: clientType,
        email: pickString(row, [...FIELD_ALIASES.email]) ?? null,
        telephone: pickString(row, [...FIELD_ALIASES.telephone]) ?? null,
        adresse: pickString(row, [...FIELD_ALIASES.adresse]) ?? null,
        ville: pickString(row, [...FIELD_ALIASES.ville]) ?? null,
        pays: pickString(row, [...FIELD_ALIASES.pays]) ?? "Côte d'Ivoire",
        creditLimit: String(pickNumber(row, [...FIELD_ALIASES.credit_limit]) ?? 0),
        ncc: pickString(row, [...FIELD_ALIASES.ncc]) ?? null,
        exonereTva: pickBoolean(row, [...FIELD_ALIASES.exonere_tva]) ?? false,
        exonereAirsi: pickBoolean(row, [...FIELD_ALIASES.exonere_airsi]) ?? false,
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
