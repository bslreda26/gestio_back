import { fneNomTvaFromTaux } from '#constants/fne_tva'
import {
  isDevis,
  isFactureInvalide,
  isFactureRetour,
  isFactureValide,
} from '#constants/vente_statuts'
import { isFneCertificationSuccessful, formatFneErrorMessage, resolveFneStoredInvoiceId } from '#helpers/fne_response_parser'
import Apikey from '#models/apikey'
import Client from '#models/client'
import Paiement from '#models/paiement'
import PointDeVente from '#models/point_de_vente'
import Produit from '#models/produit'
import Vente from '#models/vente'
import VenteLigne from '#models/vente_ligne'
import { roundMoney } from '#services/pricing_service'
import { getActiveApiKey } from '#services/apikey_service'
import { DateTime } from 'luxon'

export type FneInvoiceItemPayload = {
  quantity: number
  reference: string
  description: string
  discount: number
  amount: number
  taxes: string[]
  customTaxes: { name: string; amount: number }[]
}

export type FneInvoicePayload = {
  amount: number
  clientCompanyName: string
  clientEmail: string | null
  clientNcc: string | null
  clientPhone: string | null
  invoiceType: 'sale' | 'refund'
  items: FneInvoiceItemPayload[]
  paymentMethod: 'cash' | 'deferred'
  vatAmount: number
  isRne: boolean
  template: 'B2B' | 'B2C'
  pointOfSale: string
  establishment: string
  discount: number
  date: string
  commercialMessage: string
}

export type FneRefundItemPayload = {
  id: string
  quantity: number
}

export type FneRefundPayload = {
  items: FneRefundItemPayload[]
}

export type FneSignResponse = {
  statusCode?: number
  invoice?: {
    id?: string
    items?: { id?: string; reference?: string }[]
  }
  message?: string | string[]
  reference?: string
  token?: string
  ncc?: string
}

export class FneCertificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FneCertificationError'
  }
}

/** Prix unitaire HT catalogue (avant remise ligne) — attendu par la FNE dans `items[].amount`. */
function lignePrixUnitaireHt(ligne: VenteLigne): number {
  const qty = Number(ligne.quantite)
  if (qty <= 0) return 0
  const tvaPct = Number(ligne.tvaPct)
  const prixUnitaireTtc = Number(ligne.prixUnitaire)
  if (prixUnitaireTtc > 0) {
    return roundMoney(prixUnitaireTtc / (1 + tvaPct / 100))
  }
  return roundMoney(Number(ligne.montantHt) / qty)
}

function buildCommercialMessage(numero: string, notes: string | null): string {
  const base = `ref: ${numero}`
  if (!notes?.trim()) return base
  return `${base} ${notes.trim()}`
}

function ligneReference(ligne: VenteLigne, produitsById: Map<number, Produit>): string {
  const produit = produitsById.get(ligne.produitId)
  return produit?.code ?? `PROD-${ligne.produitId}`
}

function isTimbreLigne(
  ligne: VenteLigne,
  produitsById: Map<number, Produit>,
  timbreRef: string | null
): boolean {
  return Boolean(timbreRef && ligneReference(ligne, produitsById) === timbreRef)
}

function ligneCustomTaxes(airsiPct: number): { name: string; amount: number }[] {
  const rate = Number(airsiPct)
  if (!Number.isFinite(rate) || rate <= 0) return []
  // FNE customTaxes.amount = taux (%) — pas le montant en FCFA
  return [{ name: 'AIRSI', amount: rate }]
}

export function buildFneInvoicePayload(input: {
  vente: Vente
  client: Client
  pointDeVente: PointDeVente
  lignes: VenteLigne[]
  produitsById: Map<number, Produit>
  paymentMethod: 'cash' | 'deferred'
  invoiceType?: 'sale' | 'refund'
}): FneInvoicePayload {
  const { vente, client, pointDeVente, lignes, produitsById, paymentMethod } = input
  const timbreRef = pointDeVente.timbreReference?.trim() || null
  const hasAirsi = lignes.some((ligne) => Number(ligne.airsiPct) > 0)

  const items: FneInvoiceItemPayload[] = []

  for (const ligne of lignes) {
    if (isTimbreLigne(ligne, produitsById, timbreRef)) {
      continue
    }

    const reference = ligneReference(ligne, produitsById)

    items.push({
      quantity: Number(ligne.quantite),
      reference,
      description: ligne.designation,
      discount: Number(ligne.remisePct),
      amount: lignePrixUnitaireHt(ligne),
      taxes: [fneNomTvaFromTaux(Number(ligne.tvaPct))],
      customTaxes: ligneCustomTaxes(Number(ligne.airsiPct)),
    })
  }

  if (items.length === 0) {
    throw new FneCertificationError('Aucune ligne éligible pour la certification FNE')
  }

  const template = client.type === 'B2B' ? 'B2B' : 'B2C'

  return {
    amount: hasAirsi ? Number(vente.totalApresAirsi) : Number(vente.totalTtc),
    clientCompanyName: client.nom,
    clientEmail: client.email,
    clientNcc: client.ncc,
    clientPhone: client.telephone,
    invoiceType: input.invoiceType ?? 'sale',
    items,
    paymentMethod,
    vatAmount: Number(vente.tvaMontant),
    isRne: false,
    template,
    pointOfSale: pointDeVente.pointOfSale ?? pointDeVente.nom,
    establishment: pointDeVente.establishment ?? pointDeVente.nom,
    discount: Number(vente.remisePct),
    date: vente.dateVente.toISODate()!,
    commercialMessage: buildCommercialMessage(vente.numero, vente.notes),
  }
}

export function buildFneRefundItems(
  lignesRetour: VenteLigne[],
  lignesOrigineById: Map<number, VenteLigne>,
  factureOrigineNumero: string
): FneRefundItemPayload[] {
  const items: FneRefundItemPayload[] = []

  for (const ligne of lignesRetour) {
    if (!ligne.ligneOrigineId) {
      throw new FneCertificationError(
        `La ligne ${ligne.id} du retour n'est pas liée à une ligne de la facture d'origine`
      )
    }

    const ligneOrigine = lignesOrigineById.get(ligne.ligneOrigineId)
    if (!ligneOrigine) {
      throw new FneCertificationError(
        `Ligne d'origine ${ligne.ligneOrigineId} introuvable sur la facture ${factureOrigineNumero}`
      )
    }

    if (!ligneOrigine.fneItemId?.trim()) {
      throw new FneCertificationError(
        `La ligne "${ligneOrigine.designation}" de la facture ${factureOrigineNumero} n'a pas d'identifiant FNE — certifiez d'abord la facture d'origine`
      )
    }

    items.push({
      id: ligneOrigine.fneItemId,
      quantity: Number(ligne.quantite),
    })
  }

  if (items.length === 0) {
    throw new FneCertificationError('Aucune ligne éligible pour la certification de l\'avoir')
  }

  return items
}

export function buildFneRefundPayload(items: FneRefundItemPayload[]): FneRefundPayload {
  return { items }
}

async function resolvePaymentMethod(
  vente: Vente,
  lignes: VenteLigne[],
  produitsById: Map<number, Produit>,
  pointDeVente: PointDeVente
): Promise<'cash' | 'deferred'> {
  const timbreRef = pointDeVente.timbreReference?.trim()
  if (timbreRef) {
    const hasTimbre = lignes.some((ligne) => {
      const produit = produitsById.get(ligne.produitId)
      return produit?.code === timbreRef
    })
    if (hasTimbre) return 'cash'
  }

  const paiements = await Paiement.query()
    .where('type', 'vente')
    .where('reference_id', vente.id)

  if (paiements.some((p) => p.modePaiement === 'especes')) {
    return 'cash'
  }

  return 'deferred'
}

async function resolveActiveApiKey(): Promise<Apikey> {
  const apiKey = await getActiveApiKey()
  if (!apiKey) {
    throw new FneCertificationError('Configuration FNE introuvable — renseignez la table apikeys')
  }
  return apiKey
}

export async function signInvoiceWithFne(
  apiKey: Apikey,
  payload: FneInvoicePayload
): Promise<FneSignResponse> {
  const url = `${apiKey.prodUrl.replace(/\/$/, '')}/external/invoices/sign`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.key}`,
    },
    body: JSON.stringify(payload),
  })

  const raw = await response.text()
  let parsed: FneSignResponse
  try {
    parsed = JSON.parse(raw) as FneSignResponse
  } catch {
    throw new FneCertificationError(
      `Réponse FNE invalide (HTTP ${response.status}) : ${raw.slice(0, 200)}`
    )
  }

  if (!response.ok && !parsed.statusCode) {
    parsed.statusCode = response.status
  }

  return parsed
}

export async function signRefundWithFne(
  apiKey: Apikey,
  parentInvoiceId: string,
  items: FneRefundItemPayload[]
): Promise<FneSignResponse> {
  const url = `${apiKey.prodUrl.replace(/\/$/, '')}/external/invoices/${encodeURIComponent(parentInvoiceId)}/refund`
  const payload = buildFneRefundPayload(items)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.key}`,
    },
    body: JSON.stringify(payload),
  })

  const raw = await response.text()
  let parsed: FneSignResponse
  try {
    parsed = JSON.parse(raw) as FneSignResponse
  } catch {
    throw new FneCertificationError(
      `Réponse FNE invalide (HTTP ${response.status}) : ${raw.slice(0, 200)}`
    )
  }

  if (!response.ok && !parsed.statusCode) {
    parsed.statusCode = response.status
  }

  return parsed
}

async function loadCertificationContext(venteId: number) {
  const vente = await Vente.query().where('id', venteId).firstOrFail()
  const client = await Client.query().where('id', vente.clientId).firstOrFail()
  const pointDeVente = await PointDeVente.query().where('id', vente.pointDeVenteId).firstOrFail()
  const lignes = await VenteLigne.query().where('vente_id', vente.id).orderBy('id', 'asc')

  const produitIds = [...new Set(lignes.map((l) => l.produitId))]
  const produits = produitIds.length
    ? await Produit.query().whereIn('id', produitIds)
    : []
  const produitsById = new Map(produits.map((p) => [p.id, p]))

  return { vente, client, pointDeVente, lignes, produitsById }
}

async function loadRetourCertificationContext(venteId: number) {
  const { vente, client, pointDeVente, lignes, produitsById } =
    await loadCertificationContext(venteId)

  if (!vente.factureOrigineId) {
    throw new FneCertificationError('Ce retour n\'est pas lié à une facture d\'origine')
  }

  const factureOrigine = await Vente.query().where('id', vente.factureOrigineId).firstOrFail()
  const lignesOrigine = await VenteLigne.query()
    .where('vente_id', factureOrigine.id)
    .orderBy('id', 'asc')
  const lignesOrigineById = new Map(lignesOrigine.map((l) => [l.id, l]))

  return {
    vente,
    client,
    pointDeVente,
    lignes,
    produitsById,
    factureOrigine,
    lignesOrigineById,
  }
}

function assertCommonCertifiable(
  vente: Vente,
  client: Client,
  lignes: VenteLigne[],
  pointDeVente: PointDeVente
) {
  if (vente.excluded) {
    throw new FneCertificationError('Cette facture est exclue de la certification')
  }
  if (vente.normalise) {
    throw new FneCertificationError('Cette facture est déjà certifiée')
  }
  if (lignes.length === 0) {
    throw new FneCertificationError('La facture ne contient aucune ligne')
  }
  if (client.type === 'B2B' && !client.ncc?.trim()) {
    throw new FneCertificationError('Le NCC du client est obligatoire pour une facture B2B')
  }
  if (!pointDeVente.pointOfSale?.trim() && !pointDeVente.nom?.trim()) {
    throw new FneCertificationError('Le point de vente FNE est mal configuré')
  }
}

export function assertVenteCertifiable(
  vente: Vente,
  client: Client,
  lignes: VenteLigne[],
  pointDeVente: PointDeVente
) {
  assertCommonCertifiable(vente, client, lignes, pointDeVente)

  if (isDevis(vente.statut)) {
    throw new FneCertificationError('Un devis ne peut pas être certifié')
  }
  if (isFactureRetour(vente.statut)) {
    throw new FneCertificationError(
      'Utilisez la certification avoir — ce document est un retour'
    )
  }
  if (isFactureInvalide(vente.statut)) {
    throw new FneCertificationError('La facture doit être validée avant la certification FNE')
  }
  if (!isFactureValide(vente.statut)) {
    throw new FneCertificationError('Seule une facture validée peut être certifiée')
  }
}

function assertRetourCertifiable(
  retour: Vente,
  client: Client,
  lignes: VenteLigne[],
  pointDeVente: PointDeVente,
  factureOrigine: Vente
) {
  assertCommonCertifiable(retour, client, lignes, pointDeVente)

  if (!isFactureRetour(retour.statut)) {
    throw new FneCertificationError('Seul un avoir (retour) peut être certifié via ce flux')
  }
  if (!factureOrigine.normalise || !factureOrigine.fneInvoiceId?.trim()) {
    throw new FneCertificationError(
      `La facture d'origine ${factureOrigine.numero} doit être certifiée FNE avant l'avoir`
    )
  }
}

async function persistCertificationResult(
  vente: Vente,
  lignes: VenteLigne[],
  produitsById: Map<number, Produit>,
  fneResponse: FneSignResponse
) {
  const apiResponse = JSON.stringify(fneResponse)
  const certified = isFneCertificationSuccessful(fneResponse)

  vente.apiResponse = apiResponse
  vente.testNormalise = fneResponse.statusCode === 500
  vente.normalise = certified

  if (certified) {
    const invoiceId = resolveFneStoredInvoiceId(fneResponse as Record<string, unknown>)?.trim()
    if (!invoiceId) {
      throw new FneCertificationError("Identifiant facture FNE manquant dans la réponse")
    }
    vente.fneInvoiceId = invoiceId
    vente.certifiedAt = DateTime.now()
  }

  await vente.save()

  if (certified && fneResponse.invoice?.items?.length) {
    const timbreRef = (await PointDeVente.find(vente.pointDeVenteId))?.timbreReference?.trim()

    for (const ligne of lignes) {
      const produit = produitsById.get(ligne.produitId)
      const reference = produit?.code ?? `PROD-${ligne.produitId}`
      if (timbreRef && reference === timbreRef) continue

      const fneItem = fneResponse.invoice!.items!.find((item) => item.reference === reference)
      if (fneItem?.id) {
        ligne.fneItemId = fneItem.id
        await ligne.save()
      }
    }
  }

  if (!certified) {
    throw new FneCertificationError(
      formatFneErrorMessage(fneResponse as Record<string, unknown>)
    )
  }

  return vente
}

async function persistRefundCertificationResult(
  retour: Vente,
  lignesRetour: VenteLigne[],
  produitsById: Map<number, Produit>,
  fneResponse: FneSignResponse
) {
  const vente = await persistCertificationResult(
    retour,
    lignesRetour,
    produitsById,
    fneResponse
  )

  if (fneResponse.invoice?.items?.length) {
    for (let i = 0; i < lignesRetour.length; i++) {
      const fneItem = fneResponse.invoice.items[i]
      if (fneItem?.id) {
        lignesRetour[i].fneItemId = fneItem.id
        await lignesRetour[i].save()
      }
    }
  }

  return vente
}

export async function certifierRetourParId(venteId: number): Promise<Vente> {
  const { vente, client, pointDeVente, lignes, produitsById, factureOrigine, lignesOrigineById } =
    await loadRetourCertificationContext(venteId)

  assertRetourCertifiable(vente, client, lignes, pointDeVente, factureOrigine)

  const refundItems = buildFneRefundItems(lignes, lignesOrigineById, factureOrigine.numero)
  const apiKey = await resolveActiveApiKey()
  const fneResponse = await signRefundWithFne(
    apiKey,
    factureOrigine.fneInvoiceId!,
    refundItems
  )

  return persistRefundCertificationResult(vente, lignes, produitsById, fneResponse)
}

export async function certifierVenteParId(venteId: number): Promise<Vente> {
  const vente = await Vente.findOrFail(venteId)

  if (isFactureRetour(vente.statut)) {
    return certifierRetourParId(venteId)
  }

  const { vente: sale, client, pointDeVente, lignes, produitsById } =
    await loadCertificationContext(venteId)

  assertVenteCertifiable(sale, client, lignes, pointDeVente)

  const paymentMethod = await resolvePaymentMethod(sale, lignes, produitsById, pointDeVente)
  const payload = buildFneInvoicePayload({
    vente: sale,
    client,
    pointDeVente,
    lignes,
    produitsById,
    paymentMethod,
    invoiceType: 'sale',
  })

  const apiKey = await resolveActiveApiKey()
  const fneResponse = await signInvoiceWithFne(apiKey, payload)

  return persistCertificationResult(sale, lignes, produitsById, fneResponse)
}

export async function certifierVenteParNumero(numero: string): Promise<Vente> {
  const vente = await Vente.findBy('numero', numero)
  if (!vente) {
    throw new FneCertificationError(`Facture introuvable : ${numero}`)
  }
  return certifierVenteParId(vente.id)
}

/** Re-apply certification flags from ventes.api_response (e.g. after a false 422). */
export async function repairCertificationFromStoredApiResponse(venteId: number): Promise<Vente> {
  const { vente, lignes, produitsById } = await loadCertificationContext(venteId)

  if (vente.normalise) {
    throw new FneCertificationError('Cette facture est déjà marquée comme certifiée')
  }
  if (!vente.apiResponse?.trim()) {
    throw new FneCertificationError('Aucune réponse FNE stockée sur cette facture')
  }

  let fneResponse: FneSignResponse
  try {
    fneResponse = JSON.parse(vente.apiResponse) as FneSignResponse
  } catch {
    throw new FneCertificationError('Réponse FNE stockée invalide (JSON)')
  }

  if (!isFneCertificationSuccessful(fneResponse)) {
    throw new FneCertificationError(
      "La réponse FNE stockée ne contient pas de certification valide"
    )
  }

  return persistCertificationResult(vente, lignes, produitsById, fneResponse)
}
