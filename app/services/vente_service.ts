import {
  VENTE_STATUT,
  type VenteCreateStatut,
  affectsClientSolde,
  isDevis,
  isEditableVente,
  isFactureInvalide,
  isFactureRetour,
  isFactureValide,
  isPaiementBlocked,
} from '#constants/vente_statuts'
import Client from '#models/client'
import Produit from '#models/produit'
import Vente from '#models/vente'
import VenteLigne from '#models/vente_ligne'
import Paiement from '#models/paiement'
import TvaGroupe from '#models/tva_groupe'
import { calcMargeLigne, calculerMargeFacture, roundMoney, validatePrixPlancher } from '#services/pricing_service'
import { enregistrerEntree as stockEntree, enregistrerSortie as stockSortie } from '#services/stock_service'
import {
  canVenteAuDetail,
  formatStockLabel,
  getContenance,
  ligneQuantiteStock,
  resolvePlancherLigne,
  resolvePrixUnitaireLigne,
  resolveStockDisplay,
  toStockQuantite,
  type ModeVente,
} from '#services/vente_unite_service'
import {
  assertCaisseOuverte,
  enregistrerEntree as caisseEntree,
  enregistrerSortie as caisseSortie,
} from '#services/caisse_service'
import {
  generateRetourNumero,
  generateVenteNumero,
} from '#services/code_generator_service'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { calcAirsi } from '#constants/fne_tva'
import { DateTime } from 'luxon'

export type LigneVenteInput = {
  produit_id: number
  quantite: number
  mode_vente?: ModeVente
  prix_unitaire?: number
  remise_pct?: number
}

export type LigneRetourInput = {
  ligne_id: number
  quantite: number
}

export type CalculatedLigne = {
  produitId: number
  designation: string
  modeVente: ModeVente
  quantite: number
  quantiteStock: number
  prixUnitaire: number
  plancherLigne: number
  marge: number
  remisePct: number
  tvaPct: number
  montantHt: number
  montantTva: number
  montantTtc: number
}

export class VenteBusinessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VenteBusinessError'
  }
}

function calcLigneMontants(
  quantite: number,
  prixUnitaireTtc: number,
  tvaPct: number,
  remisePct: number
) {
  const brutTtc = roundMoney(quantite * prixUnitaireTtc)
  const remise = roundMoney(brutTtc * (remisePct / 100))
  const montantTtc = roundMoney(brutTtc - remise)
  const montantHt = roundMoney(montantTtc / (1 + tvaPct / 100))
  const montantTva = roundMoney(montantTtc - montantHt)
  return { montantHt, montantTva, montantTtc }
}

export function calculerTotauxVente(
  lignes: CalculatedLigne[],
  remisePct = 0,
  remiseMontant = 0,
  airsiPct = 0
) {
  const sousTotal = roundMoney(lignes.reduce((s, l) => s + l.montantTtc, 0))
  const totalHtBrut = roundMoney(lignes.reduce((s, l) => s + l.montantHt, 0))
  const tvaBrut = roundMoney(lignes.reduce((s, l) => s + l.montantTva, 0))

  const remiseGlobalePct = roundMoney(totalHtBrut * (remisePct / 100))
  const totalRemise = roundMoney(Math.min(totalHtBrut, remiseGlobalePct + remiseMontant))
  const totalHt = roundMoney(totalHtBrut - totalRemise)

  let tvaMontant: number
  if (totalHtBrut > 0 && totalRemise > 0) {
    const factor = totalHt / totalHtBrut
    tvaMontant = roundMoney(
      lignes.reduce((s, l) => s + roundMoney(l.montantHt * factor * (l.tvaPct / 100)), 0)
    )
  } else {
    tvaMontant = tvaBrut
  }

  const totalTtc = roundMoney(totalHt + tvaMontant)
  const { marge, margePct } = calculerMargeFacture(lignes, sousTotal, totalTtc)
  const { airsiMontant, totalApresAirsi } = calcAirsi(totalTtc, airsiPct)
  return {
    sousTotal,
    remiseMontant: totalRemise,
    totalHt,
    tvaMontant,
    totalTtc,
    airsiPct,
    airsiMontant,
    totalApresAirsi,
    marge,
    margePct,
  }
}

export async function buildLignesFromPayload(
  lignes: LigneVenteInput[],
  checkPlancher: boolean,
  trx?: TransactionClientContract
): Promise<CalculatedLigne[]> {
  const result: CalculatedLigne[] = []

  for (const ligne of lignes) {
    const query = trx ? Produit.query({ client: trx }) : Produit.query()
    const produit = await query.where('id', ligne.produit_id).where('is_active', true).first()
    if (!produit) throw new VenteBusinessError(`Produit ${ligne.produit_id} introuvable`)

    const mode: ModeVente = ligne.mode_vente ?? 'piece'
    if (mode === 'detail' && !canVenteAuDetail(produit)) {
      throw new VenteBusinessError(`Le produit ${produit.nom} ne peut pas être vendu au détail`)
    }

    const tvaQuery = trx ? TvaGroupe.query({ client: trx }) : TvaGroupe.query()
    const tvaGroupe = await tvaQuery.where('id', produit.tvaGroupeId).first()
    const tvaPct = Number(tvaGroupe?.taux ?? 0)
    const plancherLigne = resolvePlancherLigne(produit, mode)
    const prixUnitaire = resolvePrixUnitaireLigne(produit, mode, ligne.prix_unitaire)
    const quantiteStock = toStockQuantite(mode, ligne.quantite, produit)

    if (checkPlancher && mode !== 'detail') {
      validatePrixPlancher(prixUnitaire, plancherLigne, produit.nom)
    }

    const remisePct = ligne.remise_pct ?? 0
    const { montantHt, montantTva, montantTtc } = calcLigneMontants(
      ligne.quantite,
      prixUnitaire,
      tvaPct,
      remisePct
    )

    result.push({
      produitId: produit.id,
      designation: produit.nom,
      modeVente: mode,
      quantite: ligne.quantite,
      quantiteStock,
      prixUnitaire,
      plancherLigne,
      marge: calcMargeLigne(prixUnitaire, plancherLigne),
      remisePct,
      tvaPct,
      montantHt,
      montantTva,
      montantTtc,
    })
  }

  return result
}

export async function getLigneVenteInfo(
  produitId: number,
  quantite = 1,
  remisePct = 0,
  checkPlancher = false,
  modeVente: ModeVente = 'piece'
) {
  const [ligne] = await buildLignesFromPayload(
    [{ produit_id: produitId, quantite, remise_pct: remisePct, mode_vente: modeVente }],
    checkPlancher
  )

  const produit = await Produit.findOrFail(produitId)
  const stockDetail = Number(produit.stockActuel)
  const contenance = getContenance(produit)
  const stockDisplay = resolveStockDisplay(produit, stockDetail)

  return {
    produit_id: produit.id,
    code: produit.code,
    designation: ligne.designation,
    mode_vente: ligne.modeVente,
    quantite: ligne.quantite,
    quantite_stock: ligne.quantiteStock,
    prix_unitaire: ligne.prixUnitaire,
    prix_vente_ttc: Number(produit.prixVenteTtc),
    prix_detail:
      contenance > 1 ? roundMoney(Number(produit.prixVenteTtc) / contenance) : Number(produit.prixVenteTtc),
    plancher: ligne.plancherLigne,
    marge: ligne.marge,
    remise_pct: ligne.remisePct,
    tva_pct: ligne.tvaPct,
    montant_ht: ligne.montantHt,
    montant_tva: ligne.montantTva,
    montant_ttc: ligne.montantTtc,
    stock_actuel: stockDisplay.stockDetail,
    stock_pieces: stockDisplay.stockPieces,
    stock_reste_detail: stockDisplay.stockResteDetail,
    stock_label: stockDisplay.stockLabel,
    contenance,
    unite: produit.unite,
    unite_gros: produit.uniteGros,
    vente_au_detail: canVenteAuDetail(produit),
  }
}

export async function verifierCreditClient(
  clientId: number,
  montant: number,
  trx?: TransactionClientContract
) {
  const query = trx ? Client.query({ client: trx }) : Client.query()
  const client = await query.where('id', clientId).firstOrFail()
  const nouveauSolde = Number(client.solde) + montant
  if (Number(client.creditLimit) > 0 && nouveauSolde > Number(client.creditLimit)) {
    throw new VenteBusinessError(
      `Limite de crédit dépassée pour ${client.nom} (limite: ${client.creditLimit}, solde après vente: ${nouveauSolde})`
    )
  }
  return client
}

async function persistLignes(
  venteId: number,
  lignes: CalculatedLigne[],
  trx: TransactionClientContract,
  extra?: { ligneOrigineId?: number }
) {
  for (const l of lignes) {
    await VenteLigne.create(
      {
        venteId,
        produitId: l.produitId,
        designation: l.designation,
        quantite: l.quantite,
        modeVente: l.modeVente,
        quantiteStock: l.quantiteStock,
        prixUnitaire: l.prixUnitaire,
        plancherLigne: l.plancherLigne,
        marge: l.marge,
        remisePct: l.remisePct,
        tvaPct: l.tvaPct,
        montantHt: l.montantHt,
        montantTva: l.montantTva,
        montantTtc: l.montantTtc,
        quantiteRetournee: 0,
        ligneOrigineId: extra?.ligneOrigineId ?? null,
      },
      { client: trx }
    )
  }
}

async function applyStockSortie(
  venteId: number,
  lignes: CalculatedLigne[],
  userId: number,
  trx: TransactionClientContract
) {
  for (const l of lignes) {
    await stockSortie(
      l.produitId,
      l.quantiteStock,
      'vente',
      { referenceId: venteId, referenceType: 'vente' },
      userId,
      trx
    )
  }
}

async function applyStockEntreeRetour(
  venteId: number,
  lignes: CalculatedLigne[],
  userId: number,
  trx: TransactionClientContract
) {
  for (const l of lignes) {
    await stockEntree(
      l.produitId,
      l.quantiteStock,
      'retour_client',
      { referenceId: venteId, referenceType: 'vente_retour' },
      userId,
      trx
    )
  }
}

export type PointDeVenteParams = {
  pointDeVenteId: number
  pointDeVenteCode: string
}

export type CreateVenteInput = {
  statut: VenteCreateStatut
  client_id: number
  date_vente: DateTime
  date_echeance?: DateTime | null
  remise_pct?: number
  remise_montant?: number
  airsi_pct?: number
  notes?: string | null
  lignes: LigneVenteInput[]
}

export type UpdateVenteInput = {
  id: number
  client_id?: number
  date_vente?: DateTime
  date_echeance?: DateTime | null
  remise_pct?: number
  remise_montant?: number
  airsi_pct?: number
  notes?: string | null
  lignes?: LigneVenteInput[]
}

function assertVenteModifiablePourFne(vente: Vente) {
  if (vente.normalise) {
    throw new VenteBusinessError('Une facture certifiée FNE ne peut plus être modifiée')
  }
}

function venteLigneToCalculated(ligne: VenteLigne): CalculatedLigne {
  return {
    produitId: ligne.produitId,
    designation: ligne.designation,
    modeVente: (ligne.modeVente as ModeVente) || 'piece',
    quantite: Number(ligne.quantite),
    quantiteStock: ligneQuantiteStock(ligne),
    prixUnitaire: Number(ligne.prixUnitaire),
    plancherLigne: Number(ligne.plancherLigne),
    marge: Number(ligne.marge),
    remisePct: Number(ligne.remisePct),
    tvaPct: Number(ligne.tvaPct),
    montantHt: Number(ligne.montantHt),
    montantTva: Number(ligne.montantTva),
    montantTtc: Number(ligne.montantTtc),
  }
}

async function restituerStockFacture(
  venteId: number,
  numero: string,
  lignes: VenteLigne[],
  userId: number,
  trx: TransactionClientContract
) {
  for (const ligne of lignes) {
    await stockEntree(
      ligne.produitId,
      ligneQuantiteStock(ligne),
      'retour_client',
      { referenceId: venteId, referenceType: 'vente_modification' },
      userId,
      trx,
      `Modification facture ${numero}`
    )
  }
}

async function ajusterSoldeClientsFacture(
  ancienClientId: number,
  nouveauClientId: number,
  ancienTotal: number,
  nouveauTotal: number,
  trx: TransactionClientContract
) {
  if (ancienClientId === nouveauClientId) {
    const client = await Client.query({ client: trx })
      .where('id', nouveauClientId)
      .forUpdate()
      .firstOrFail()
    const nouveauSolde = roundMoney(Number(client.solde) - ancienTotal + nouveauTotal)
    if (Number(client.creditLimit) > 0 && nouveauSolde > Number(client.creditLimit)) {
      throw new VenteBusinessError(
        `Limite de crédit dépassée pour ${client.nom} (limite: ${client.creditLimit}, solde après modification: ${nouveauSolde})`
      )
    }
    client.solde = nouveauSolde
    client.useTransaction(trx)
    await client.save()
    return
  }

  const ancienClient = await Client.query({ client: trx })
    .where('id', ancienClientId)
    .forUpdate()
    .firstOrFail()
  ancienClient.solde = roundMoney(Math.max(0, Number(ancienClient.solde) - ancienTotal))
  ancienClient.useTransaction(trx)
  await ancienClient.save()

  const nouveauClient = await Client.query({ client: trx })
    .where('id', nouveauClientId)
    .forUpdate()
    .firstOrFail()
  const nouveauSolde = roundMoney(Number(nouveauClient.solde) + nouveauTotal)
  if (Number(nouveauClient.creditLimit) > 0 && nouveauSolde > Number(nouveauClient.creditLimit)) {
    throw new VenteBusinessError(
      `Limite de crédit dépassée pour ${nouveauClient.nom} (limite: ${nouveauClient.creditLimit}, solde après modification: ${nouveauSolde})`
    )
  }
  nouveauClient.solde = nouveauSolde
  nouveauClient.useTransaction(trx)
  await nouveauClient.save()
}

export async function creerVente(
  data: CreateVenteInput,
  userId: number,
  pos: PointDeVenteParams
) {
  const numero = await generateVenteNumero(data.statut, pos.pointDeVenteCode)

  return Vente.transaction(async (trx) => {
    if (isFactureInvalide(data.statut)) {
      await assertCaisseOuverte(pos.pointDeVenteId, trx)
    }

    const checkPlancher = isFactureInvalide(data.statut)
    const checkStock = isFactureInvalide(data.statut)
    const calculated = await buildLignesFromPayload(data.lignes, checkPlancher, trx)

    if (checkStock) {
      for (const l of calculated) {
        const produit = await Produit.query({ client: trx }).where('id', l.produitId).firstOrFail()
        if (Number(produit.stockActuel) < l.quantiteStock) {
          throw new VenteBusinessError(
            `Stock insuffisant pour ${produit.nom} (disponible: ${formatStockLabel(produit, Number(produit.stockActuel))})`
          )
        }
      }
    }

    const airsiPct = data.airsi_pct ?? 0
    const totaux = calculerTotauxVente(
      calculated,
      data.remise_pct ?? 0,
      data.remise_montant ?? 0,
      airsiPct
    )

    if (isFactureInvalide(data.statut)) {
      await verifierCreditClient(data.client_id, totaux.totalApresAirsi, trx)
    }

    const vente = await Vente.create(
      {
        numero,
        pointDeVenteId: pos.pointDeVenteId,
        clientId: data.client_id,
        userId,
        devisOrigineId: null,
        factureOrigineId: null,
        dateVente: data.date_vente,
        dateEcheance: data.date_echeance ?? null,
        statut: data.statut,
        statutPaiement: 'non_paye',
        sousTotal: totaux.sousTotal,
        remisePct: data.remise_pct ?? 0,
        remiseMontant: totaux.remiseMontant,
        totalHt: totaux.totalHt,
        tvaMontant: totaux.tvaMontant,
        totalTtc: totaux.totalTtc,
        airsiPct: totaux.airsiPct,
        airsiMontant: totaux.airsiMontant,
        totalApresAirsi: totaux.totalApresAirsi,
        marge: totaux.marge,
        margePct: totaux.margePct,
        montantPaye: 0,
        resteAPayer: totaux.totalApresAirsi,
        notes: data.notes ?? null,
      },
      { client: trx }
    )

    await persistLignes(vente.id, calculated, trx)

    if (isFactureInvalide(data.statut)) {
      await applyStockSortie(vente.id, calculated, userId, trx)
      const client = await Client.query({ client: trx }).where('id', data.client_id).firstOrFail()
      client.solde = roundMoney(Number(client.solde) + totaux.totalApresAirsi)
      client.useTransaction(trx)
      await client.save()
    }

    return vente
  })
}

export async function mettreAJourVente(
  data: UpdateVenteInput,
  userId: number,
  pointDeVenteId?: number
) {
  return Vente.transaction(async (trx) => {
    const vente = await Vente.query({ client: trx }).where('id', data.id).forUpdate().firstOrFail()

    if (!isEditableVente(vente.statut)) {
      throw new VenteBusinessError('Seul un devis ou une facture non validée peut être modifié')
    }

    assertVenteModifiablePourFne(vente)

    const isFacture = isFactureInvalide(vente.statut)

    if (isFacture) {
      if (Number(vente.montantPaye) > 0) {
        throw new VenteBusinessError(
          'Impossible de modifier une facture avec des paiements enregistrés'
        )
      }
      const retourLie = await Vente.query({ client: trx })
        .where('facture_origine_id', vente.id)
        .first()
      if (retourLie) {
        throw new VenteBusinessError('Impossible de modifier une facture ayant un retour associé')
      }
      await assertCaisseOuverte(pointDeVenteId ?? vente.pointDeVenteId, trx)
    }

    const ancienClientId = vente.clientId
    const ancienTotal = Number(vente.totalApresAirsi)
    const anciennesLignes = await VenteLigne.query({ client: trx }).where('vente_id', vente.id)

    const remisePct = data.remise_pct ?? Number(vente.remisePct)
    const remiseMontantInput = data.remise_montant ?? 0
    const airsiPct = data.airsi_pct ?? Number(vente.airsiPct)

    let calculated: CalculatedLigne[]

    if (data.lignes) {
      if (isFacture) {
        await restituerStockFacture(vente.id, vente.numero, anciennesLignes, userId, trx)
      }

      await VenteLigne.query({ client: trx }).where('vente_id', vente.id).delete()
      calculated = await buildLignesFromPayload(data.lignes, isFacture, trx)

      if (isFacture) {
        for (const l of calculated) {
          const produit = await Produit.query({ client: trx }).where('id', l.produitId).firstOrFail()
          if (Number(produit.stockActuel) < l.quantiteStock) {
            throw new VenteBusinessError(
              `Stock insuffisant pour ${produit.nom} (disponible: ${formatStockLabel(produit, Number(produit.stockActuel))})`
            )
          }
        }
        await applyStockSortie(vente.id, calculated, userId, trx)
      }

      await persistLignes(vente.id, calculated, trx)
    } else {
      calculated = anciennesLignes.map(venteLigneToCalculated)
    }

    const totaux = calculerTotauxVente(calculated, remisePct, remiseMontantInput, airsiPct)
    const nouveauClientId = data.client_id ?? vente.clientId

    if (isFacture) {
      await ajusterSoldeClientsFacture(
        ancienClientId,
        nouveauClientId,
        ancienTotal,
        totaux.totalApresAirsi,
        trx
      )
    }

    vente.merge({
      clientId: nouveauClientId,
      dateVente: data.date_vente ?? vente.dateVente,
      dateEcheance:
        data.date_echeance !== undefined ? data.date_echeance : vente.dateEcheance,
      remisePct,
      airsiPct: totaux.airsiPct,
      airsiMontant: totaux.airsiMontant,
      totalApresAirsi: totaux.totalApresAirsi,
      notes: data.notes !== undefined ? data.notes ?? null : vente.notes,
      sousTotal: totaux.sousTotal,
      remiseMontant: totaux.remiseMontant,
      totalHt: totaux.totalHt,
      tvaMontant: totaux.tvaMontant,
      totalTtc: totaux.totalTtc,
      marge: totaux.marge,
      margePct: totaux.margePct,
      resteAPayer: totaux.totalApresAirsi,
      montantPaye: 0,
      statutPaiement: 'non_paye',
    })
    vente.useTransaction(trx)
    await vente.save()

    return vente
  })
}

export async function convertirDevisEnFacture(
  venteId: number,
  userId: number,
  posCode: string,
  pointDeVenteId?: number
) {
  const nouveauNumero = await generateVenteNumero(VENTE_STATUT.NON_VALIDE, posCode)

  return Vente.transaction(async (trx) => {
    const vente = await Vente.query({ client: trx }).where('id', venteId).forUpdate().firstOrFail()

    await assertCaisseOuverte(pointDeVenteId ?? vente.pointDeVenteId, trx)

    if (!isDevis(vente.statut)) {
      throw new VenteBusinessError('Seul un devis peut être converti en facture')
    }

    const lignesDb = await VenteLigne.query({ client: trx }).where('vente_id', venteId)
    const lignesInput: LigneVenteInput[] = lignesDb.map((l) => ({
      produit_id: l.produitId,
      quantite: Number(l.quantite),
      mode_vente: (l.modeVente as ModeVente) || 'piece',
      prix_unitaire: Number(l.prixUnitaire),
      remise_pct: Number(l.remisePct),
    }))

    const calculated = await buildLignesFromPayload(lignesInput, true, trx)

    for (const l of calculated) {
      const produit = await Produit.query({ client: trx }).where('id', l.produitId).firstOrFail()
      if (Number(produit.stockActuel) < l.quantiteStock) {
        throw new VenteBusinessError(
          `Stock insuffisant pour ${produit.nom} (disponible: ${formatStockLabel(produit, Number(produit.stockActuel))})`
        )
      }
    }

    const totaux = calculerTotauxVente(
      calculated,
      Number(vente.remisePct),
      0,
      Number(vente.airsiPct)
    )

    await verifierCreditClient(vente.clientId, totaux.totalApresAirsi, trx)

    vente.merge({
      statut: VENTE_STATUT.NON_VALIDE,
      numero: nouveauNumero,
      sousTotal: totaux.sousTotal,
      remiseMontant: totaux.remiseMontant,
      totalHt: totaux.totalHt,
      tvaMontant: totaux.tvaMontant,
      totalTtc: totaux.totalTtc,
      airsiMontant: totaux.airsiMontant,
      totalApresAirsi: totaux.totalApresAirsi,
      marge: totaux.marge,
      margePct: totaux.margePct,
      resteAPayer: totaux.totalApresAirsi,
    })
    vente.useTransaction(trx)
    await vente.save()

    await VenteLigne.query({ client: trx }).where('vente_id', venteId).delete()
    await persistLignes(vente.id, calculated, trx)
    await applyStockSortie(vente.id, calculated, userId, trx)

    const client = await Client.query({ client: trx }).where('id', vente.clientId).firstOrFail()
    client.solde = roundMoney(Number(client.solde) + totaux.totalApresAirsi)
    client.useTransaction(trx)
    await client.save()

    return vente
  })
}

export async function validerFacture(venteId: number) {
  return Vente.transaction(async (trx) => {
    const vente = await Vente.query({ client: trx }).where('id', venteId).forUpdate().firstOrFail()
    if (!isFactureInvalide(vente.statut)) {
      throw new VenteBusinessError('Seule une facture non validée peut être validée')
    }
    vente.statut = VENTE_STATUT.VALIDE
    vente.useTransaction(trx)
    await vente.save()
    return vente
  })
}

/** Supprime une facture non validée : retour stock, annulation solde client, suppression du document. */
export async function supprimerFacture(venteId: number, userId: number) {
  return Vente.transaction(async (trx) => {
    const vente = await Vente.query({ client: trx }).where('id', venteId).forUpdate().firstOrFail()

    if (!isFactureInvalide(vente.statut)) {
      if (isFactureValide(vente.statut)) {
        throw new VenteBusinessError(
          'Une facture validée ne peut pas être supprimée — utilisez un retour (facture retour)'
        )
      }
      throw new VenteBusinessError('Seule une facture non validée peut être supprimée')
    }

    if (Number(vente.montantPaye) > 0) {
      throw new VenteBusinessError(
        'Impossible de supprimer une facture avec des paiements enregistrés'
      )
    }

    const retourLie = await Vente.query({ client: trx })
      .where('facture_origine_id', venteId)
      .first()
    if (retourLie) {
      throw new VenteBusinessError('Impossible de supprimer une facture ayant un retour associé')
    }

    const lignes = await VenteLigne.query({ client: trx }).where('vente_id', venteId)

    for (const ligne of lignes) {
      await stockEntree(
        ligne.produitId,
        ligneQuantiteStock(ligne),
        'retour_client',
        { referenceId: venteId, referenceType: 'vente_suppression' },
        userId,
        trx,
        `Suppression facture ${vente.numero}`
      )
    }

    const client = await Client.query({ client: trx }).where('id', vente.clientId).firstOrFail()
    client.solde = roundMoney(Math.max(0, Number(client.solde) - Number(vente.totalApresAirsi)))
    client.useTransaction(trx)
    await client.save()

    const numero = vente.numero
    await VenteLigne.query({ client: trx }).where('vente_id', venteId).delete()
    vente.useTransaction(trx)
    await vente.delete()

    return { numero }
  })
}

export async function annulerDevis(venteId: number, _notes?: string | null) {
  return Vente.transaction(async (trx) => {
    const vente = await Vente.query({ client: trx }).where('id', venteId).forUpdate().firstOrFail()
    if (!isDevis(vente.statut)) {
      throw new VenteBusinessError(
        'Les factures ne peuvent pas être annulées — utilisez un retour (facture retour)'
      )
    }
    const numero = vente.numero
    await VenteLigne.query({ client: trx }).where('vente_id', venteId).delete()
    vente.useTransaction(trx)
    await vente.delete()
    return { id: venteId, numero }
  })
}

/**
 * Facture retour — admin only.
 * Returns goods to stock and creates a RET-YYYY-XXXX document linked to the original invoice.
 */
export async function creerFactureRetour(
  factureId: number,
  lignesRetour: LigneRetourInput[],
  userId: number,
  pos: PointDeVenteParams,
  notes?: string | null
) {
  const numeroRetour = await generateRetourNumero(pos.pointDeVenteCode)

  return Vente.transaction(async (trx) => {
    const facture = await Vente.query({ client: trx }).where('id', factureId).forUpdate().firstOrFail()

    if (!affectsClientSolde(facture.statut)) {
      throw new VenteBusinessError(
        'Le retour est possible uniquement sur une facture validée ou non validée'
      )
    }

    const calculated: CalculatedLigne[] = []

    for (const item of lignesRetour) {
      const ligneOrigine = await VenteLigne.query({ client: trx })
        .where('id', item.ligne_id)
        .where('vente_id', factureId)
        .firstOrFail()

      const dejaRetourne = Number(ligneOrigine.quantiteRetournee ?? 0)
      const maxRetour = Number(ligneOrigine.quantite) - dejaRetourne

      if (item.quantite <= 0 || item.quantite > maxRetour) {
        throw new VenteBusinessError(
          `Quantité retour invalide pour la ligne ${item.ligne_id} (max: ${maxRetour})`
        )
      }

      const { montantHt, montantTva, montantTtc } = calcLigneMontants(
        item.quantite,
        Number(ligneOrigine.prixUnitaire),
        Number(ligneOrigine.tvaPct),
        Number(ligneOrigine.remisePct)
      )

      const mode = (ligneOrigine.modeVente as ModeVente) || 'piece'
      const produit = await Produit.query({ client: trx })
        .where('id', ligneOrigine.produitId)
        .firstOrFail()
      const quantiteStock = toStockQuantite(mode, item.quantite, produit)

      calculated.push({
        produitId: ligneOrigine.produitId,
        designation: ligneOrigine.designation,
        modeVente: mode,
        quantite: item.quantite,
        quantiteStock,
        prixUnitaire: Number(ligneOrigine.prixUnitaire),
        plancherLigne: Number(ligneOrigine.plancherLigne),
        marge: Number(ligneOrigine.marge),
        remisePct: Number(ligneOrigine.remisePct),
        tvaPct: Number(ligneOrigine.tvaPct),
        montantHt,
        montantTva,
        montantTtc,
      })

      ligneOrigine.quantiteRetournee = roundMoney(dejaRetourne + item.quantite)
      ligneOrigine.useTransaction(trx)
      await ligneOrigine.save()
    }

    const totaux = calculerTotauxVente(calculated)

    const retour = await Vente.create(
      {
        numero: numeroRetour,
        pointDeVenteId: pos.pointDeVenteId,
        clientId: facture.clientId,
        userId,
        devisOrigineId: null,
        factureOrigineId: facture.id,
        dateVente: DateTime.now(),
        dateEcheance: null,
        statut: VENTE_STATUT.RETOUR,
        statutPaiement: 'non_paye',
        sousTotal: totaux.sousTotal,
        remisePct: 0,
        remiseMontant: 0,
        totalHt: totaux.totalHt,
        tvaMontant: totaux.tvaMontant,
        totalTtc: totaux.totalTtc,
        airsiPct: 0,
        airsiMontant: 0,
        totalApresAirsi: totaux.totalTtc,
        marge: totaux.marge,
        margePct: totaux.margePct,
        montantPaye: 0,
        resteAPayer: totaux.totalTtc,
        notes: notes ?? `Retour sur facture ${facture.numero}`,
      },
      { client: trx }
    )

    for (let i = 0; i < calculated.length; i++) {
      const l = calculated[i]
      const origine = lignesRetour[i]
      await VenteLigne.create(
        {
          venteId: retour.id,
          produitId: l.produitId,
          designation: l.designation,
          quantite: l.quantite,
          modeVente: l.modeVente,
          quantiteStock: l.quantiteStock,
          prixUnitaire: l.prixUnitaire,
          plancherLigne: l.plancherLigne,
          marge: l.marge,
          remisePct: l.remisePct,
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

    await applyStockEntreeRetour(retour.id, calculated, userId, trx)

    const client = await Client.query({ client: trx }).where('id', facture.clientId).firstOrFail()
    client.solde = roundMoney(Math.max(0, Number(client.solde) - totaux.totalTtc))
    facture.resteAPayer = roundMoney(Math.max(0, Number(facture.resteAPayer) - totaux.totalTtc))
    client.useTransaction(trx)
    facture.useTransaction(trx)
    await client.save()
    await facture.save()

    return { retour, facture }
  })
}

export type PaiementVenteInput = {
  vente_id: number
  montant: number
  mode_paiement: 'especes' | 'cheque' | 'virement' | 'mobile_money' | 'carte'
  date_paiement: DateTime
  reference_paiement?: string | null
  notes?: string | null
}

export async function enregistrerPaiementVente(data: PaiementVenteInput, userId: number) {
  return Vente.transaction(async (trx) => {
    const vente = await Vente.query({ client: trx }).where('id', data.vente_id).forUpdate().firstOrFail()

    await assertCaisseOuverte(vente.pointDeVenteId, trx)

    if (isPaiementBlocked(vente.statut)) {
      throw new VenteBusinessError('Paiement impossible sur ce document')
    }

    if (data.montant <= 0) {
      throw new VenteBusinessError('Le montant du paiement doit être positif')
    }

    const reste = Number(vente.resteAPayer)
    if (data.montant > reste + 0.01) {
      throw new VenteBusinessError(`Montant supérieur au reste à payer (${reste})`)
    }

    const paiement = await Paiement.create(
      {
        type: 'vente',
        referenceId: vente.id,
        montant: data.montant,
        modePaiement: data.mode_paiement,
        datePaiement: data.date_paiement,
        referencePaiement: data.reference_paiement ?? null,
        userId,
        notes: data.notes ?? null,
      },
      { client: trx }
    )

    vente.montantPaye = roundMoney(Number(vente.montantPaye) + data.montant)
    vente.resteAPayer = roundMoney(
      Math.max(0, Number(vente.totalApresAirsi) - Number(vente.montantPaye))
    )

    if (vente.resteAPayer <= 0) vente.statutPaiement = 'paye'
    else if (vente.montantPaye > 0) vente.statutPaiement = 'partiel'
    else vente.statutPaiement = 'non_paye'

    vente.useTransaction(trx)
    await vente.save()

    if (!isFactureRetour(vente.statut) && affectsClientSolde(vente.statut)) {
      const client = await Client.query({ client: trx }).where('id', vente.clientId).firstOrFail()
      client.solde = roundMoney(Math.max(0, Number(client.solde) - data.montant))
      client.useTransaction(trx)
      await client.save()
    }

    if (data.mode_paiement === 'especes') {
      const isRetour = isFactureRetour(vente.statut)
      if (isRetour) {
        await caisseSortie(
          vente.pointDeVenteId,
          data.montant,
          'retour_especes',
          `Remboursement retour ${vente.numero}`,
          { referenceId: paiement.id, referenceType: 'paiement' },
          userId,
          trx
        )
      } else {
        await caisseEntree(
          vente.pointDeVenteId,
          data.montant,
          'vente_especes',
          `Encaissement ${vente.numero}`,
          { referenceId: paiement.id, referenceType: 'paiement' },
          userId,
          trx
        )
      }
    }

    return { vente, paiement }
  })
}
