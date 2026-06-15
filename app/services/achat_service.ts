import {
  ACHAT_STATUT,
  canPayerAchat,
  canReceiveMarchandise,
  isAchatRetour,
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
}

export type LigneRecueInput = {
  ligne_id: number
  quantite_recue: number
}

export type LigneAchatRetourInput = {
  ligne_id: number
  quantite: number
}

export type CalculatedAchatLigne = {
  produitId: number
  designation: string
  modeAchat: ModeVente
  quantite: number
  quantiteStock: number
  prixUnitaireHt: number
  frais: number
  tvaPct: number
  montantHt: number
  montantTva: number
  montantTtc: number
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

function calcLigneMontants(quantite: number, prixUnitaireHt: number, tvaPct: number) {
  const montantHt = roundMoney(quantite * prixUnitaireHt)
  const montantTva = roundMoney(montantHt * (tvaPct / 100))
  const montantTtc = roundMoney(montantHt + montantTva)
  return { montantHt, montantTva, montantTtc }
}

export function calcReceptionTtc(quantiteRecue: number, prixUnitaireHt: number, tvaPct: number) {
  const { montantTtc } = calcLigneMontants(quantiteRecue, prixUnitaireHt, tvaPct)
  return montantTtc
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
  const remise = roundMoney(Math.min(remiseMontant, sousTotal))
  const totalTtc = roundMoney(Math.max(0, sousTotal - remise))
  const tvaMontant = roundMoney(lignes.reduce((s, l) => s + l.montantTva, 0))
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
    const { montantHt, montantTva, montantTtc } = calcLigneMontants(
      ligne.quantite,
      prixUnitaireHt,
      tvaPct
    )

    result.push({
      produitId: produit.id,
      designation: produit.nom,
      modeAchat: ACHAT_MODE_GROS,
      quantite: ligne.quantite,
      quantiteStock,
      prixUnitaireHt,
      frais,
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
  frais?: number
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
  const quantiteStock = toStockQuantite(ACHAT_MODE_GROS, quantite, produit)
  const cmup = toAchatCmupUnits(ACHAT_MODE_GROS, quantite, prixHt, fraisLigne, produit)
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
  const { montantHt, montantTva, montantTtc } = calcLigneMontants(quantite, prixHt, tvaPct)
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

export async function recevoirMarchandise(
  achatId: number,
  lignesRecues: LigneRecueInput[],
  userId: number,
  dateReception?: DateTime
) {
  return Achat.transaction(async (trx) => {
    const achat = await Achat.query({ client: trx }).where('id', achatId).forUpdate().firstOrFail()

    if (!canReceiveMarchandise(achat.statut)) {
      throw new AchatBusinessError('Réception impossible sur cet achat')
    }

    const lignesAvant = await AchatLigne.query({ client: trx }).where('achat_id', achatId)
    const hasRemaining = lignesAvant.some(
      (l) => Number(l.quantiteRecue) < Number(l.quantite)
    )
    if (!hasRemaining) {
      throw new AchatBusinessError('Réception déjà complète sur cet achat')
    }

    let receptionTtcTotal = 0

    for (const item of lignesRecues) {
      const ligne = await AchatLigne.query({ client: trx })
        .where('id', item.ligne_id)
        .where('achat_id', achatId)
        .firstOrFail()

      const dejaRecu = Number(ligne.quantiteRecue)
      const maxRecu = Number(ligne.quantite) - dejaRecu

      if (item.quantite_recue <= 0 || item.quantite_recue > maxRecu + 0.0001) {
        throw new AchatBusinessError(
          `Quantité reçue invalide pour la ligne ${item.ligne_id} (max: ${maxRecu})`
        )
      }

      const produit = await Produit.query({ client: trx }).where('id', ligne.produitId).firstOrFail()
      const stockAvant = Number(produit.stockActuel)
      const mode = achatLigneMode(ligne)
      const quantiteRecueStock = toStockQuantite(mode, item.quantite_recue, produit)
      const cmup = toAchatCmupUnits(
        mode,
        item.quantite_recue,
        Number(ligne.prixUnitaireHt),
        Number(ligne.frais),
        produit
      )

      await stockEntree(
        ligne.produitId,
        quantiteRecueStock,
        'achat',
        { referenceId: achatId, referenceType: 'achat' },
        userId,
        trx
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

      ligne.quantiteRecue = roundMoney(dejaRecu + item.quantite_recue)
      ligne.useTransaction(trx)
      await ligne.save()

      receptionTtcTotal += calcReceptionTtc(
        item.quantite_recue,
        Number(ligne.prixUnitaireHt),
        Number(ligne.tvaPct)
      )
    }

    receptionTtcTotal = roundMoney(receptionTtcTotal)

    if (receptionTtcTotal > 0) {
      const fournisseur = await Fournisseur.query({ client: trx })
        .where('id', achat.fournisseurId)
        .firstOrFail()
      fournisseur.solde = roundMoney(Number(fournisseur.solde) + receptionTtcTotal)
      fournisseur.useTransaction(trx)
      await fournisseur.save()

      achat.resteAPayer = roundMoney(Number(achat.resteAPayer) + receptionTtcTotal)
    }

    const allLignes = await AchatLigne.query({ client: trx }).where('achat_id', achatId)
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
      `Retour achat ${numero}`
    )
  }
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
  notes?: string | null
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
        },
        { client: trx }
      )
    }

    await applyStockSortieAchatRetour(retour.id, retour.numero, lignesCalculees, userId, trx)

    const fournisseur = await Fournisseur.query({ client: trx })
      .where('id', achat.fournisseurId)
      .firstOrFail()
    fournisseur.solde = roundMoney(Math.max(0, Number(fournisseur.solde) - totaux.totalTtc))
    achat.resteAPayer = roundMoney(Math.max(0, Number(achat.resteAPayer) - totaux.totalTtc))
    fournisseur.useTransaction(trx)
    achat.useTransaction(trx)
    await fournisseur.save()
    await achat.save()

    return { retour, achat }
  })
}

export async function annulerAchat(achatId: number, userId: number, notes?: string | null) {
  return Achat.transaction(async (trx) => {
    const achat = await Achat.query({ client: trx }).where('id', achatId).forUpdate().firstOrFail()

    if (achat.statut === ACHAT_STATUT.ANNULE) {
      throw new AchatBusinessError('Cet achat est déjà annulé')
    }

    if (Number(achat.montantPaye) > 0) {
      throw new AchatBusinessError(
        'Impossible d\'annuler un achat avec des paiements enregistrés'
      )
    }

    const lignes = await AchatLigne.query({ client: trx }).where('achat_id', achatId)
    let receivedTtcToReverse = 0

    for (const ligne of lignes) {
      const qtyRecue = Number(ligne.quantiteRecue)
      if (qtyRecue > 0) {
        const produit = await Produit.query({ client: trx })
          .where('id', ligne.produitId)
          .firstOrFail()
        const qtyStock = toStockQuantite(achatLigneMode(ligne), qtyRecue, produit)

        await stockSortie(
          ligne.produitId,
          qtyStock,
          'retour_fournisseur',
          { referenceId: achatId, referenceType: 'achat' },
          userId,
          trx,
          `Annulation achat ${achat.numero}`
        )
        receivedTtcToReverse += calcReceptionTtc(
          qtyRecue,
          Number(ligne.prixUnitaireHt),
          Number(ligne.tvaPct)
        )
        ligne.quantiteRecue = 0
        ligne.useTransaction(trx)
        await ligne.save()
      }
    }

    receivedTtcToReverse = roundMoney(receivedTtcToReverse)

    if (receivedTtcToReverse > 0) {
      const fournisseur = await Fournisseur.query({ client: trx })
        .where('id', achat.fournisseurId)
        .firstOrFail()
      fournisseur.solde = roundMoney(Math.max(0, Number(fournisseur.solde) - receivedTtcToReverse))
      fournisseur.useTransaction(trx)
      await fournisseur.save()
    }

    achat.statut = ACHAT_STATUT.ANNULE
    achat.resteAPayer = 0
    if (notes) achat.notes = notes
    achat.useTransaction(trx)
    await achat.save()

    return achat
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

    if (achat.resteAPayer <= 0) achat.statutPaiement = 'paye'
    else if (achat.montantPaye > 0) achat.statutPaiement = 'partiel'
    else achat.statutPaiement = 'non_paye'

    achat.useTransaction(trx)
    await achat.save()

    if (!isRetour) {
      const fournisseur = await Fournisseur.query({ client: trx })
        .where('id', achat.fournisseurId)
        .firstOrFail()
      fournisseur.solde = roundMoney(Math.max(0, Number(fournisseur.solde) - data.montant))
      fournisseur.useTransaction(trx)
      await fournisseur.save()
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
