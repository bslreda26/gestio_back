import {
  ACHAT_STATUT,
  canAnnulerAchat,
  canPayerAchat,
  canReceiveMarchandise,
  isAchatRecu,
  isAchatRetour,
  isEditableAchat,
} from '#constants/achat_statuts'
import Achat from '#models/achat'
import AchatLigne from '#models/achat_ligne'
import Fournisseur from '#models/fournisseur'
import Paiement from '#models/paiement'
import Produit from '#models/produit'
import TvaGroupe from '#models/tva_groupe'
import { serializeAchatCataloguePrix } from '#helpers/produit_serializer'
import {
  roundMoney,
  updateProduitFromAchatReception,
} from '#services/pricing_service'
import { adjustFournisseurSoldePdv } from '#services/fournisseur_solde_service'
import { resolveDepotForPointDeVente } from '#services/depot_service'
import { enregistrerEntree as stockEntree, enregistrerSortie as stockSortie } from '#services/stock_service'
import {
  assertCaisseOuverte,
  enregistrerEntree as caisseEntree,
  enregistrerSortie as caisseSortie,
} from '#services/caisse_service'
import { generateAchatNumero, generateAchatRetourNumero } from '#services/code_generator_service'
import {
  achatLigneMode,
  fromProduitPrixStockage,
  catalogueFraisGros,
  cataloguePrixGros,
  getContenance,
  hasUniteDetailConfig,
  resolveStockDisplay,
  roundQty,
  toAchatCmupUnits,
  toPrixAchatGros,
  toStockQuantite,
  type ModeVente,
} from '#services/vente_unite_service'

/** Les achats sont toujours saisis en unité gros (pièce / sac / carton). */
const ACHAT_MODE_GROS: ModeVente = 'piece'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

export type LigneAchatInput = {
  produit_id: number
  quantite: number
  prix_unitaire_ht?: number
  frais?: number
  remise_pct?: number
}

export type LigneRecueInput = {
  ligne_id: number
  quantite_recue: number
}

function buildReceptionCompleteLignes(
  lignes: Awaited<ReturnType<typeof AchatLigne.query>>
): LigneRecueInput[] {
  return lignes
    .map((ligne) => {
      const reste = roundQty(Number(ligne.quantite) - Number(ligne.quantiteRecue))
      return reste > 0 ? { ligne_id: ligne.id, quantite_recue: reste } : null
    })
    .filter((item): item is LigneRecueInput => item !== null)
}

export type LigneAchatRetourInput = {
  ligne_id: number
  quantite: number
  depot_id?: number
}

export type LigneRetourDirectInput = {
  produit_id: number
  quantite: number
  depot_id?: number
}

export type CreateRetourDirectInput = {
  fournisseur_id: number
  date_achat?: DateTime
  notes?: string | null
  depot_id?: number
  lignes: LigneRetourDirectInput[]
}

export type CalculatedAchatLigne = {
  produitId: number
  designation: string
  modeAchat: ModeVente
  quantite: number
  quantiteStock: number
  prixUnitaireHt: number
  frais: number
  remisePct: number
  tvaPct: number
  montantHt: number
  montantTva: number
  montantTtc: number
  depotId?: number
}

export class AchatBusinessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AchatBusinessError'
  }
}

/** Frais ligne achat (unité gros) : saisie utilisateur, sinon frais catalogue produit, sinon dernier achat. */
export function resolveFraisAchatLigneGros(
  produitFraisGros: number,
  dernierGrosFrais: number | null | undefined,
  fraisSaisi?: number
): number {
  if (fraisSaisi !== undefined) return fraisSaisi
  if (produitFraisGros > 0) return produitFraisGros
  if (dernierGrosFrais != null && dernierGrosFrais > 0) return dernierGrosFrais
  return 0
}

/** Prix unitaire HT après remise ligne (base CMUP). */
export function prixHtApresRemiseLigne(prixUnitaireHt: number, remisePct: number): number {
  return roundMoney(prixUnitaireHt * (1 - remisePct / 100))
}

/** Répartit la remise facture (HT) au prorata du montant HT de chaque ligne. */
export function calcRemiseFactureHtParLigne(
  lignes: { montantHt: number }[],
  remiseMontant: number
): number[] {
  const totalHt = roundMoney(lignes.reduce((s, l) => s + Number(l.montantHt), 0))
  if (totalHt <= 0 || remiseMontant <= 0) return lignes.map(() => 0)

  const remise = roundMoney(Math.min(remiseMontant, totalHt))
  const parts = lignes.map((l) =>
    roundMoney(remise * (Number(l.montantHt) / totalHt))
  )
  const sum = roundMoney(parts.reduce((a, b) => a + b, 0))
  if (sum !== remise && parts.length > 0) {
    parts[parts.length - 1] = roundMoney(parts[parts.length - 1] + (remise - sum))
  }
  return parts
}

/** Prix unitaire HT pour CMUP : remise ligne + part proportionnelle de la remise facture. */
export function calcPrixHtCmupAchatLigne(
  ligne: { montantHt: number; quantite: number },
  remiseFactureHtLigne: number,
  quantiteRecue: number
): number {
  if (quantiteRecue <= 0) return 0
  const orderedQty = Number(ligne.quantite)
  const fraction = orderedQty > 0 ? quantiteRecue / orderedQty : 1
  const htRecu = roundMoney(Number(ligne.montantHt) * fraction)
  const remiseRecu = roundMoney(remiseFactureHtLigne * fraction)
  const netHtRecu = roundMoney(Math.max(0, htRecu - remiseRecu))
  return roundMoney(netHtRecu / quantiteRecue)
}

export function calcLigneMontants(
  quantite: number,
  prixUnitaireHt: number,
  tvaPct: number,
  remisePct = 0
) {
  const brutHt = roundMoney(quantite * prixUnitaireHt)
  const remiseHt = roundMoney(brutHt * (remisePct / 100))
  const montantHt = roundMoney(brutHt - remiseHt)
  const montantTva = roundMoney(montantHt * (tvaPct / 100))
  const montantTtc = roundMoney(montantHt + montantTva)
  return { montantHt, montantTva, montantTtc }
}

export function calcReceptionTtc(
  quantiteRecue: number,
  prixUnitaireHt: number,
  tvaPct: number,
  remisePct = 0
) {
  const { montantTtc } = calcLigneMontants(quantiteRecue, prixUnitaireHt, tvaPct, remisePct)
  return montantTtc
}

type LigneReceivedTtcInput = {
  quantiteRecue: number | string
  prixUnitaireHt: number | string
  tvaPct: number | string
  remisePct?: number | string | null
}

/** Somme TTC des quantités déjà reçues (remise ligne incluse, remise facture exclue). */
export function calcTotalReceivedLinesTtc(lignes: LigneReceivedTtcInput[]): number {
  return roundMoney(
    lignes.reduce((sum, ligne) => {
      const qty = Number(ligne.quantiteRecue)
      if (qty <= 0) return sum
      return (
        sum +
        calcReceptionTtc(
          qty,
          Number(ligne.prixUnitaireHt),
          Number(ligne.tvaPct),
          Number(ligne.remisePct ?? 0)
        )
      )
    }, 0)
  )
}

type LigneOwedInput = {
  quantite: number | string
  quantiteRecue: number | string
  montantHt: number | string
  montantTva: number | string
}

/** Dette TTC due au fournisseur après réception (remise facture HT répartie au prorata). */
export function calcOwedTtcFromReceivedLines(
  lignes: LigneOwedInput[],
  remiseMontant: number
): number {
  const normalized = lignes.map((l) => ({
    quantite: Number(l.quantite),
    quantiteRecue: Number(l.quantiteRecue),
    montantHt: Number(l.montantHt),
    montantTva: Number(l.montantTva),
  }))
  const remiseParts = calcRemiseFactureHtParLigne(
    normalized.map((l) => ({ montantHt: l.montantHt })),
    remiseMontant
  )

  let netHt = 0
  let netTva = 0
  for (const [i, ligne] of normalized.entries()) {
    const qtyRecue = ligne.quantiteRecue
    if (qtyRecue <= 0) continue
    const fraction = ligne.quantite > 0 ? qtyRecue / ligne.quantite : 0
    const htRecu = roundMoney(ligne.montantHt * fraction)
    const tvaRecu = roundMoney(ligne.montantTva * fraction)
    const remiseRecu = roundMoney(remiseParts[i] * fraction)
    netHt = roundMoney(netHt + htRecu - remiseRecu)
    netTva = roundMoney(netTva + tvaRecu)
  }

  return roundMoney(Math.max(0, netHt + netTva))
}

/** Dernier prix d'achat connu, toujours exprimé en unité gros (pièce / sac…) */
export async function getDernierPrixAchatGrosForProduit(
  produitId: number,
  trx?: TransactionClientContract
): Promise<{ prixUnitaireHt: number; frais: number } | null> {
  const produitQuery = trx ? Produit.query({ client: trx }) : Produit.query()
  const produit = await produitQuery.where('id', produitId).first()
  if (!produit) return null

  const base = trx ? AchatLigne.query({ client: trx }) : AchatLigne.query()
  const ligne = await base
    .join('achats', 'achats.id', 'achat_lignes.achat_id')
    .where('achat_lignes.produit_id', produitId)
    .whereNotIn('achats.statut', [ACHAT_STATUT.ANNULE, ACHAT_STATUT.RETOUR])
    .orderBy('achats.date_achat', 'desc')
    .orderBy('achat_lignes.id', 'desc')
    .select(
      'achat_lignes.prix_unitaire_ht',
      'achat_lignes.frais',
      'achat_lignes.mode_achat'
    )
    .first()

  if (!ligne) return null

  return toPrixAchatGros(
    Number(ligne.prixUnitaireHt),
    Number(ligne.frais),
    achatLigneMode(ligne),
    produit
  )
}

export function calculerTotauxAchat(lignes: CalculatedAchatLigne[], remiseMontant = 0) {
  const sousTotal = roundMoney(lignes.reduce((s, l) => s + l.montantTtc, 0))
  const totalHt = roundMoney(lignes.reduce((s, l) => s + l.montantHt, 0))
  const remise = roundMoney(Math.min(remiseMontant, totalHt))
  const netHt = roundMoney(Math.max(0, totalHt - remise))
  const tvaMontant = roundMoney(lignes.reduce((s, l) => s + l.montantTva, 0))
  const totalTtc = roundMoney(netHt + tvaMontant)
  return { sousTotal, remiseMontant: remise, tvaMontant, totalTtc }
}

export async function buildLignesFromPayload(
  lignes: LigneAchatInput[],
  trx?: TransactionClientContract
): Promise<CalculatedAchatLigne[]> {
  const result: CalculatedAchatLigne[] = []

  for (const ligne of lignes) {
    const produitQuery = trx ? Produit.query({ client: trx }) : Produit.query()
    const produit = await produitQuery
      .where('id', ligne.produit_id)
      .where('is_active', true)
      .first()
    if (!produit) throw new AchatBusinessError(`Produit ${ligne.produit_id} introuvable`)

    const tvaQuery = trx ? TvaGroupe.query({ client: trx }) : TvaGroupe.query()
    const tvaGroupe = await tvaQuery.where('id', produit.tvaGroupeId).first()
    const tvaPct = Number(tvaGroupe?.taux ?? 0)

    const cataloguePrix = fromProduitPrixStockage(produit)
    const produitFraisGros = catalogueFraisGros(cataloguePrix)
    const dernierGros = await getDernierPrixAchatGrosForProduit(ligne.produit_id, trx)

    let prixUnitaireHt: number

    if (ligne.prix_unitaire_ht !== undefined) {
      prixUnitaireHt = ligne.prix_unitaire_ht
    } else {
      prixUnitaireHt =
        dernierGros?.prixUnitaireHt ??
        (Number(produit.dernierPrixAchatHt) || cataloguePrixGros(cataloguePrix))
    }

    const frais = resolveFraisAchatLigneGros(produitFraisGros, dernierGros?.frais, ligne.frais)

    if (prixUnitaireHt <= 0) {
      throw new AchatBusinessError(
        `Prix d'achat HT requis pour ${produit.nom} (aucun achat précédent)`
      )
    }
    const quantiteStock = toStockQuantite(ACHAT_MODE_GROS, ligne.quantite, produit)
    const remisePct = ligne.remise_pct ?? 0
    const { montantHt, montantTva, montantTtc } = calcLigneMontants(
      ligne.quantite,
      prixUnitaireHt,
      tvaPct,
      remisePct
    )

    result.push({
      produitId: produit.id,
      designation: produit.nom,
      modeAchat: ACHAT_MODE_GROS,
      quantite: ligne.quantite,
      quantiteStock,
      prixUnitaireHt,
      frais,
      remisePct,
      tvaPct,
      montantHt,
      montantTva,
      montantTtc,
    })
  }

  return result
}

export async function getLigneAchatInfo(
  produitId: number,
  quantite = 1,
  prixUnitaireHt?: number,
  frais?: number,
  remisePct = 0
) {
  const produit = await Produit.query().where('id', produitId).where('is_active', true).first()
  if (!produit) throw new AchatBusinessError(`Produit ${produitId} introuvable`)

  const tvaGroupe = await TvaGroupe.query().where('id', produit.tvaGroupeId).first()
  const tvaPct = Number(tvaGroupe?.taux ?? 0)

  const dernierGros = await getDernierPrixAchatGrosForProduit(produitId)
  const cataloguePrix = fromProduitPrixStockage(produit)
  const produitFraisGros = catalogueFraisGros(cataloguePrix)
  const prixGrosRef =
    dernierGros?.prixUnitaireHt ??
    (Number(produit.dernierPrixAchatHt) || cataloguePrixGros(cataloguePrix))
  const fraisGrosRef =
    produitFraisGros > 0 ? produitFraisGros : (dernierGros?.frais ?? produitFraisGros)

  let prixHt: number
  let fraisLigne: number

  if (prixUnitaireHt !== undefined) {
    prixHt = prixUnitaireHt
  } else {
    prixHt = prixGrosRef
  }
  fraisLigne = resolveFraisAchatLigneGros(produitFraisGros, dernierGros?.frais, frais)
  const prixHtCmup = prixHtApresRemiseLigne(prixHt, remisePct)
  const quantiteStock = toStockQuantite(ACHAT_MODE_GROS, quantite, produit)
  const cmup = toAchatCmupUnits(ACHAT_MODE_GROS, quantite, prixHtCmup, fraisLigne, produit)
  const stockAvant = Number(produit.stockActuel)
  const stockDisplay = resolveStockDisplay(produit, stockAvant)
  const stockApresDetail = roundQty(stockAvant + quantiteStock)
  const stockApresDisplay = resolveStockDisplay(produit, stockApresDetail)
  const prixInterne = {
    prixAchatHt: Number(produit.prixAchatHt),
    frais: Number(produit.frais),
  }
  const apresReception = updateProduitFromAchatReception({
    stockAvant,
    quantiteRecue: cmup.quantiteStock,
    prixUnitaireHt: cmup.prixUnitaireHt,
    fraisUnitaire: cmup.fraisUnitaire,
    ancienPrixAchatHt: prixInterne.prixAchatHt,
    ancienFrais: prixInterne.frais,
    tauxTva: tvaPct,
  })
  const { montantHt, montantTva, montantTtc } = calcLigneMontants(quantite, prixHt, tvaPct, remisePct)
  const contenance = getContenance(produit)
  const detailConfig = hasUniteDetailConfig(produit)
  const uniteQuantite = produit.uniteGros?.trim() || (detailConfig ? 'pièce' : '')
  const catalogueActuel = fromProduitPrixStockage(produit, tvaPct)
  const catalogueApres = fromProduitPrixStockage({
    ...produit,
    prixAchatHt: String(apresReception.prixAchatHt),
    prixAchatTtc: String(apresReception.prixAchatTtc),
    frais: String(apresReception.frais),
    plancher: String(apresReception.plancher),
  }, tvaPct)

  return {
    produit_id: produit.id,
    code: produit.code,
    designation: produit.nom,
    quantite,
    /** Saisie en gros : 1 unité = +1 stock (simple) ou × contenance (détail configuré). */
    mode_achat: ACHAT_MODE_GROS,
    unite_quantite: uniteQuantite,
    vente_detail_disponible: detailConfig,
    quantite_stock: quantiteStock,
    prix_unitaire_ht: prixHt,
    prix_gros_ht: prixGrosRef,
    remise_pct: remisePct,
    prix_ht_apres_remise: prixHtCmup,
    ...serializeAchatCataloguePrix(catalogueActuel),
    ...serializeAchatCataloguePrix(catalogueApres, 'apres'),
    frais_gros: fraisGrosRef,
    frais: fraisLigne,
    tva_pct: tvaPct,
    montant_ht: montantHt,
    montant_tva: montantTva,
    montant_ttc: montantTtc,
    stock_actuel: stockAvant,
    stock_pieces: stockDisplay.stockPieces,
    stock_reste_detail: stockDisplay.stockResteDetail,
    stock_label: stockDisplay.stockLabel,
    stock_actuel_apres: stockApresDetail,
    stock_pieces_apres: stockApresDisplay.stockPieces,
    stock_reste_detail_apres: stockApresDisplay.stockResteDetail,
    stock_label_apres: stockApresDisplay.stockLabel,
    unite: produit.unite,
    unite_gros: produit.uniteGros,
    contenance,
    dernier_prix_achat_ht: prixGrosRef,
  }
}

async function persistLignes(
  achatId: number,
  lignes: CalculatedAchatLigne[],
  trx: TransactionClientContract
) {
  for (const l of lignes) {
    await AchatLigne.create(
      {
        achatId,
        produitId: l.produitId,
        designation: l.designation,
        modeAchat: l.modeAchat,
        quantite: l.quantite,
        quantiteStock: l.quantiteStock,
        quantiteRecue: 0,
        prixUnitaireHt: l.prixUnitaireHt,
        frais: l.frais,
        remisePct: l.remisePct,
        tvaPct: l.tvaPct,
        montantHt: l.montantHt,
        montantTva: l.montantTva,
        montantTtc: l.montantTtc,
      },
      { client: trx }
    )
  }
}

export type CreateAchatInput = {
  fournisseur_id: number
  date_achat: DateTime
  reference_fournisseur?: string | null
  remise_montant?: number
  notes?: string | null
  lignes: LigneAchatInput[]
}

export async function creerAchat(
  data: CreateAchatInput,
  userId: number,
  pointDeVenteId: number,
  posCode: string
) {
  const numero = await generateAchatNumero(posCode)

  return Achat.transaction(async (trx) => {
    const fournisseur = await Fournisseur.query({ client: trx })
      .where('id', data.fournisseur_id)
      .where('is_active', true)
      .first()
    if (!fournisseur) throw new AchatBusinessError('Fournisseur introuvable')

    const calculated = await buildLignesFromPayload(data.lignes, trx)
    const totaux = calculerTotauxAchat(calculated, data.remise_montant ?? 0)

    const achat = await Achat.create(
      {
        numero,
        pointDeVenteId,
        fournisseurId: data.fournisseur_id,
        userId,
        dateAchat: data.date_achat,
        dateReception: null,
        statut: ACHAT_STATUT.COMMANDE,
        statutPaiement: 'non_paye',
        sousTotal: totaux.sousTotal,
        remiseMontant: totaux.remiseMontant,
        tvaMontant: totaux.tvaMontant,
        totalTtc: totaux.totalTtc,
        montantPaye: 0,
        resteAPayer: 0,
        referenceFournisseur: data.reference_fournisseur ?? null,
        notes: data.notes ?? null,
      },
      { client: trx }
    )

    await persistLignes(achat.id, calculated, trx)
    return achat
  })
}

export type UpdateAchatInput = {
  fournisseur_id?: number
  date_achat?: DateTime
  reference_fournisseur?: string | null
  remise_montant?: number
  notes?: string | null
  lignes?: LigneAchatInput[]
}

export async function modifierAchat(achatId: number, data: UpdateAchatInput) {
  return Achat.transaction(async (trx) => {
    const achat = await Achat.query({ client: trx }).where('id', achatId).forUpdate().firstOrFail()

    if (!isEditableAchat(achat.statut)) {
      throw new AchatBusinessError('Seule une commande peut être modifiée')
    }

    if (data.lignes) {
      await AchatLigne.query({ client: trx }).where('achat_id', achatId).delete()
      const calculated = await buildLignesFromPayload(data.lignes, trx)
      const totaux = calculerTotauxAchat(
        calculated,
        data.remise_montant ?? Number(achat.remiseMontant)
      )
      await persistLignes(achatId, calculated, trx)

      achat.sousTotal = totaux.sousTotal
      achat.remiseMontant = totaux.remiseMontant
      achat.tvaMontant = totaux.tvaMontant
      achat.totalTtc = totaux.totalTtc
    }

    if (data.fournisseur_id !== undefined) {
      const fournisseur = await Fournisseur.query({ client: trx })
        .where('id', data.fournisseur_id)
        .where('is_active', true)
        .first()
      if (!fournisseur) throw new AchatBusinessError('Fournisseur introuvable')
      achat.fournisseurId = data.fournisseur_id
    }

    if (data.date_achat !== undefined) achat.dateAchat = data.date_achat
    if (data.reference_fournisseur !== undefined) {
      achat.referenceFournisseur = data.reference_fournisseur
    }
    if (data.remise_montant !== undefined && !data.lignes) {
      const lignes = await AchatLigne.query({ client: trx }).where('achat_id', achatId)
      const calculated = lignes.map((l) => ({
        produitId: l.produitId,
        designation: l.designation,
        modeAchat: achatLigneMode(l),
        quantite: Number(l.quantite),
        quantiteStock: Number(l.quantiteStock),
        prixUnitaireHt: Number(l.prixUnitaireHt),
        frais: Number(l.frais),
        remisePct: Number(l.remisePct ?? 0),
        tvaPct: Number(l.tvaPct),
        montantHt: Number(l.montantHt),
        montantTva: Number(l.montantTva),
        montantTtc: Number(l.montantTtc),
      }))
      const totaux = calculerTotauxAchat(calculated, data.remise_montant)
      achat.sousTotal = totaux.sousTotal
      achat.remiseMontant = totaux.remiseMontant
      achat.tvaMontant = totaux.tvaMontant
      achat.totalTtc = totaux.totalTtc
    }
    if (data.notes !== undefined) achat.notes = data.notes

    achat.useTransaction(trx)
    await achat.save()
    return achat
  })
}

export async function recevoirMarchandise(
  achatId: number,
  userId: number,
  dateReception?: DateTime,
  depotId?: number
) {
  return Achat.transaction(async (trx) => {
    const achat = await Achat.query({ client: trx }).where('id', achatId).forUpdate().firstOrFail()

    if (!canReceiveMarchandise(achat.statut)) {
      if (isAchatRecu(achat.statut)) {
        throw new AchatBusinessError(
          'Réception déjà effectuée — utilisez Retour pour renvoyer des marchandises au fournisseur'
        )
      }
      throw new AchatBusinessError('Réception impossible sur cet achat')
    }

    const depot = await resolveDepotForPointDeVente(
      achat.pointDeVenteId,
      depotId ?? achat.depotId ?? undefined,
      trx
    )
    achat.depotId = depot.id
    achat.useTransaction(trx)
    await achat.save()

    const lignesAvant = await AchatLigne.query({ client: trx }).where('achat_id', achatId)
    const lignesActives = buildReceptionCompleteLignes(lignesAvant)
    if (lignesActives.length === 0) {
      throw new AchatBusinessError('Aucune quantité à recevoir')
    }

    const remiseMontant = Number(achat.remiseMontant)
    const remiseFactureParLigne = calcRemiseFactureHtParLigne(
      lignesAvant.map((l) => ({ montantHt: Number(l.montantHt) })),
      remiseMontant
    )
    const remiseFactureParLigneId = new Map<number, number>()
    lignesAvant.forEach((l, i) => remiseFactureParLigneId.set(l.id, remiseFactureParLigne[i]))

    const owedBefore = calcOwedTtcFromReceivedLines(lignesAvant, remiseMontant)

    for (const item of lignesActives) {
      const ligne = await AchatLigne.query({ client: trx })
        .where('id', item.ligne_id)
        .where('achat_id', achatId)
        .firstOrFail()

      const dejaRecu = Number(ligne.quantiteRecue)
      const maxRecu = Number(ligne.quantite) - dejaRecu

      if (item.quantite_recue > maxRecu + 0.0001) {
        throw new AchatBusinessError(
          `Quantité reçue invalide pour la ligne ${item.ligne_id} (max: ${maxRecu})`
        )
      }

      const produit = await Produit.query({ client: trx }).where('id', ligne.produitId).firstOrFail()
      const stockAvant = Number(produit.stockActuel)
      const mode = achatLigneMode(ligne)
      const quantiteRecueStock = toStockQuantite(mode, item.quantite_recue, produit)
      const remiseFactureHt = remiseFactureParLigneId.get(ligne.id) ?? 0
      const prixHtCmup = calcPrixHtCmupAchatLigne(
        { montantHt: Number(ligne.montantHt), quantite: Number(ligne.quantite) },
        remiseFactureHt,
        item.quantite_recue
      )
      const cmup = toAchatCmupUnits(
        mode,
        item.quantite_recue,
        prixHtCmup,
        Number(ligne.frais),
        produit
      )

      await stockEntree(
        ligne.produitId,
        quantiteRecueStock,
        'achat',
        { referenceId: achatId, referenceType: 'achat' },
        userId,
        trx,
        null,
        depot.id
      )

      const prixInterne = {
        prixAchatHt: Number(produit.prixAchatHt),
        frais: Number(produit.frais),
      }
      const produitUpdate = updateProduitFromAchatReception({
        stockAvant,
        quantiteRecue: cmup.quantiteStock,
        prixUnitaireHt: cmup.prixUnitaireHt,
        fraisUnitaire: cmup.fraisUnitaire,
        ancienPrixAchatHt: prixInterne.prixAchatHt,
        ancienFrais: prixInterne.frais,
        tauxTva: Number(ligne.tvaPct),
      })
      const dernierGros = toPrixAchatGros(
        Number(ligne.prixUnitaireHt),
        Number(ligne.frais),
        mode,
        produit
      )
      produit.prixAchatHt = produitUpdate.prixAchatHt
      produit.prixAchatTtc = produitUpdate.prixAchatTtc
      produit.dernierPrixAchatHt = dernierGros.prixUnitaireHt
      produit.frais = produitUpdate.frais
      produit.plancher = produitUpdate.plancher
      produit.useTransaction(trx)
      await produit.save()

      ligne.quantiteRecue = roundQty(dejaRecu + item.quantite_recue)
      ligne.useTransaction(trx)
      await ligne.save()
    }

    const allLignes = await AchatLigne.query({ client: trx }).where('achat_id', achatId)
    const owedAfter = calcOwedTtcFromReceivedLines(allLignes, remiseMontant)
    const deltaOwed = roundMoney(owedAfter - owedBefore)

    if (deltaOwed > 0) {
      await adjustFournisseurSoldePdv(
        achat.fournisseurId,
        achat.pointDeVenteId,
        deltaOwed,
        trx
      )
    }

    achat.resteAPayer = roundMoney(Math.max(0, owedAfter - Number(achat.montantPaye)))
    const anyReceived = allLignes.some((l) => Number(l.quantiteRecue) > 0)

    achat.statut = anyReceived ? ACHAT_STATUT.ACHAT : ACHAT_STATUT.COMMANDE
    achat.dateReception = dateReception ?? DateTime.now()
    achat.useTransaction(trx)
    await achat.save()

    return achat
  })
}

async function applyStockSortieAchatRetour(
  retourId: number,
  numero: string,
  lignes: CalculatedAchatLigne[],
  userId: number,
  trx: TransactionClientContract
) {
  for (const l of lignes) {
    await stockSortie(
      l.produitId,
      l.quantiteStock,
      'retour_fournisseur',
      { referenceId: retourId, referenceType: 'achat_retour' },
      userId,
      trx,
      `Retour achat ${numero}`,
      l.depotId
    )
  }
}

function resolveRetourAchatDepotId(lignes: CalculatedAchatLigne[]): number | null {
  if (lignes.length === 0) return null
  const first = lignes[0].depotId
  if (first === undefined) return null
  return lignes.every((l) => l.depotId === first) ? first : null
}

/**
 * Retour fournisseur — creates an avoir linked to a received purchase.
 * Goods leave stock; supplier balance is reduced.
 */
export async function creerAchatRetour(
  achatId: number,
  lignesRetour: LigneAchatRetourInput[],
  userId: number,
  pointDeVenteId: number,
  posCode: string,
  notes?: string | null,
  defaultDepotId?: number
) {
  const numeroRetour = await generateAchatRetourNumero(posCode)

  return Achat.transaction(async (trx) => {
    const achat = await Achat.query({ client: trx }).where('id', achatId).forUpdate().firstOrFail()

    if (!canPayerAchat(achat.statut)) {
      throw new AchatBusinessError(
        'Le retour est possible uniquement sur un achat avec marchandises reçues'
      )
    }

    if (isAchatRetour(achat.statut)) {
      throw new AchatBusinessError('Un avoir ne peut pas faire l\'objet d\'un retour')
    }

    const lignesCalculees: CalculatedAchatLigne[] = []

    for (const item of lignesRetour) {
      const ligneOrigine = await AchatLigne.query({ client: trx })
        .where('id', item.ligne_id)
        .where('achat_id', achatId)
        .firstOrFail()

      const dejaRetourne = Number(ligneOrigine.quantiteRetournee ?? 0)
      const maxRetour = Number(ligneOrigine.quantiteRecue) - dejaRetourne

      if (item.quantite <= 0 || item.quantite > maxRetour + 0.0001) {
        throw new AchatBusinessError(
          `Quantité retour invalide pour la ligne ${item.ligne_id} (max: ${maxRetour})`
        )
      }

      const mode = achatLigneMode(ligneOrigine)
      const produit = await Produit.query({ client: trx })
        .where('id', ligneOrigine.produitId)
        .firstOrFail()
      const quantiteStock = toStockQuantite(mode, item.quantite, produit)

      const { montantHt, montantTva, montantTtc } = calcLigneMontants(
        item.quantite,
        Number(ligneOrigine.prixUnitaireHt),
        Number(ligneOrigine.tvaPct)
      )

      const ligneDepot = await resolveDepotForPointDeVente(
        pointDeVenteId,
        item.depot_id ?? defaultDepotId ?? achat.depotId ?? undefined,
        trx
      )

      lignesCalculees.push({
        produitId: ligneOrigine.produitId,
        designation: ligneOrigine.designation,
        modeAchat: mode,
        quantite: item.quantite,
        quantiteStock,
        prixUnitaireHt: Number(ligneOrigine.prixUnitaireHt),
        frais: Number(ligneOrigine.frais),
        tvaPct: Number(ligneOrigine.tvaPct),
        montantHt,
        montantTva,
        montantTtc,
        depotId: ligneDepot.id,
      })

      ligneOrigine.quantiteRetournee = roundMoney(dejaRetourne + item.quantite)
      ligneOrigine.useTransaction(trx)
      await ligneOrigine.save()
    }

    const totaux = calculerTotauxAchat(lignesCalculees)

    const retour = await Achat.create(
      {
        numero: numeroRetour,
        pointDeVenteId,
        depotId: resolveRetourAchatDepotId(lignesCalculees),
        fournisseurId: achat.fournisseurId,
        userId,
        achatOrigineId: achat.id,
        dateAchat: DateTime.now(),
        dateReception: DateTime.now(),
        statut: ACHAT_STATUT.RETOUR,
        statutPaiement: 'non_paye',
        sousTotal: totaux.sousTotal,
        remiseMontant: 0,
        tvaMontant: totaux.tvaMontant,
        totalTtc: totaux.totalTtc,
        montantPaye: 0,
        resteAPayer: totaux.totalTtc,
        referenceFournisseur: null,
        notes: notes ?? `Retour sur achat ${achat.numero}`,
      },
      { client: trx }
    )

    for (let i = 0; i < lignesCalculees.length; i++) {
      const l = lignesCalculees[i]
      const origine = lignesRetour[i]
      await AchatLigne.create(
        {
          achatId: retour.id,
          produitId: l.produitId,
          designation: l.designation,
          modeAchat: l.modeAchat,
          quantite: l.quantite,
          quantiteStock: l.quantiteStock,
          quantiteRecue: l.quantite,
          prixUnitaireHt: l.prixUnitaireHt,
          frais: l.frais,
          tvaPct: l.tvaPct,
          montantHt: l.montantHt,
          montantTva: l.montantTva,
          montantTtc: l.montantTtc,
          quantiteRetournee: 0,
          ligneOrigineId: origine.ligne_id,
          depotId: l.depotId ?? null,
        },
        { client: trx }
      )
    }

    await applyStockSortieAchatRetour(
      retour.id,
      retour.numero,
      lignesCalculees,
      userId,
      trx
    )

    await adjustFournisseurSoldePdv(
      achat.fournisseurId,
      achat.pointDeVenteId,
      -totaux.totalTtc,
      trx
    )
    // L'achat d'origine conserve son reste ; le crédit est porté par l'avoir (retour) séparément.
    achat.useTransaction(trx)
    await achat.save()

    return { retour, achat, lettrage: null }
  })
}

/**
 * Retour fournisseur libre — sans achat d'origine.
 * Prix catalogue / dernier achat ; sortie stock immédiate par dépôt.
 */
export async function creerRetourDirect(
  data: CreateRetourDirectInput,
  userId: number,
  pointDeVenteId: number,
  posCode: string
) {
  const numero = await generateAchatRetourNumero(posCode)

  return Achat.transaction(async (trx) => {
    const fournisseur = await Fournisseur.query({ client: trx })
      .where('id', data.fournisseur_id)
      .where('is_active', true)
      .first()
    if (!fournisseur) throw new AchatBusinessError('Fournisseur introuvable')

    const calculated = await buildLignesFromPayload(
      data.lignes.map((l) => ({
        produit_id: l.produit_id,
        quantite: l.quantite,
      })),
      trx
    )

    const lignesCalculees: CalculatedAchatLigne[] = []
    for (let i = 0; i < calculated.length; i++) {
      const item = data.lignes[i]
      const ligneDepot = await resolveDepotForPointDeVente(
        pointDeVenteId,
        item.depot_id ?? data.depot_id ?? undefined,
        trx
      )
      lignesCalculees.push({ ...calculated[i], depotId: ligneDepot.id })
    }

    const totaux = calculerTotauxAchat(lignesCalculees)

    const retour = await Achat.create(
      {
        numero,
        pointDeVenteId,
        depotId: resolveRetourAchatDepotId(lignesCalculees),
        fournisseurId: data.fournisseur_id,
        userId,
        achatOrigineId: null,
        dateAchat: data.date_achat ?? DateTime.now(),
        dateReception: DateTime.now(),
        statut: ACHAT_STATUT.RETOUR,
        statutPaiement: 'non_paye',
        sousTotal: totaux.sousTotal,
        remiseMontant: 0,
        tvaMontant: totaux.tvaMontant,
        totalTtc: totaux.totalTtc,
        montantPaye: 0,
        resteAPayer: totaux.totalTtc,
        referenceFournisseur: null,
        notes: data.notes ?? 'Retour fournisseur',
      },
      { client: trx }
    )

    for (const l of lignesCalculees) {
      await AchatLigne.create(
        {
          achatId: retour.id,
          produitId: l.produitId,
          designation: l.designation,
          modeAchat: l.modeAchat,
          quantite: l.quantite,
          quantiteStock: l.quantiteStock,
          quantiteRecue: l.quantite,
          prixUnitaireHt: l.prixUnitaireHt,
          frais: l.frais,
          remisePct: l.remisePct,
          tvaPct: l.tvaPct,
          montantHt: l.montantHt,
          montantTva: l.montantTva,
          montantTtc: l.montantTtc,
          quantiteRetournee: 0,
          ligneOrigineId: null,
          depotId: l.depotId ?? null,
        },
        { client: trx }
      )
    }

    await applyStockSortieAchatRetour(retour.id, retour.numero, lignesCalculees, userId, trx)

    await adjustFournisseurSoldePdv(
      data.fournisseur_id,
      pointDeVenteId,
      -totaux.totalTtc,
      trx
    )

    return { retour, lettrage: null }
  })
}

export async function annulerAchat(achatId: number, _userId: number, _notes?: string | null) {
  return Achat.transaction(async (trx) => {
    const achat = await Achat.query({ client: trx }).where('id', achatId).forUpdate().firstOrFail()

    if (!canAnnulerAchat(achat.statut)) {
      if (isAchatRecu(achat.statut)) {
        throw new AchatBusinessError(
          'Impossible d\'annuler un achat déjà réceptionné — utilisez Retour'
        )
      }
      throw new AchatBusinessError('Annulation impossible sur cet achat')
    }

    const deleted = achat.serialize()
    achat.useTransaction(trx)
    await achat.delete()
    return deleted
  })
}

export type PaiementAchatInput = {
  achat_id: number
  montant: number
  mode_paiement: 'especes' | 'cheque' | 'virement' | 'mobile_money' | 'carte'
  date_paiement: DateTime
  reference_paiement?: string | null
  notes?: string | null
}

export function syncAchatPaiement(achat: {
  montantPaye: number | string
  resteAPayer: number | string
  statutPaiement: string
}) {
  const reste = roundMoney(Number(achat.resteAPayer))
  if (reste <= 0) {
    achat.resteAPayer = '0'
    achat.statutPaiement = 'paye'
  } else if (Number(achat.montantPaye) > 0) {
    achat.statutPaiement = 'partiel'
  } else {
    achat.statutPaiement = 'non_paye'
  }
}

export async function enregistrerPaiementAchat(data: PaiementAchatInput, userId: number) {
  return Achat.transaction(async (trx) => {
    const achat = await Achat.query({ client: trx }).where('id', data.achat_id).forUpdate().firstOrFail()

    if (data.mode_paiement === 'especes') {
      await assertCaisseOuverte(achat.pointDeVenteId, trx)
    }

    if (achat.statut === ACHAT_STATUT.ANNULE) {
      throw new AchatBusinessError('Paiement impossible sur un achat annulé')
    }

    const isRetour = isAchatRetour(achat.statut)

    if (!isRetour && !canPayerAchat(achat.statut)) {
      throw new AchatBusinessError('Paiement impossible avant réception des marchandises')
    }

    if (data.montant <= 0) {
      throw new AchatBusinessError('Le montant du paiement doit être positif')
    }

    const reste = Number(achat.resteAPayer)
    if (data.montant > reste + 0.01) {
      throw new AchatBusinessError(`Montant supérieur au reste à payer (${reste})`)
    }

    const paiement = await Paiement.create(
      {
        type: 'achat',
        referenceId: achat.id,
        montant: data.montant,
        modePaiement: data.mode_paiement,
        datePaiement: data.date_paiement,
        referencePaiement: data.reference_paiement ?? null,
        userId,
        notes: data.notes ?? null,
      },
      { client: trx }
    )

    achat.montantPaye = roundMoney(Number(achat.montantPaye) + data.montant)
    achat.resteAPayer = roundMoney(Math.max(0, reste - data.montant))
    syncAchatPaiement(achat)

    achat.useTransaction(trx)
    await achat.save()

    if (!isRetour) {
      await adjustFournisseurSoldePdv(
        achat.fournisseurId,
        achat.pointDeVenteId,
        -data.montant,
        trx
      )
    }

    if (data.mode_paiement === 'especes') {
      if (isRetour) {
        await caisseEntree(
          achat.pointDeVenteId,
          data.montant,
          'retour_achat_especes',
          `Encaissement retour fournisseur ${achat.numero}`,
          { referenceId: paiement.id, referenceType: 'paiement' },
          userId,
          trx
        )
      } else {
        await caisseSortie(
          achat.pointDeVenteId,
          data.montant,
          'achat_especes',
          `Paiement achat ${achat.numero}`,
          { referenceId: paiement.id, referenceType: 'paiement' },
          userId,
          trx
        )
      }
    }

    return { achat, paiement }
  })
}
