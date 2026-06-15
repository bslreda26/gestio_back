import Client from '#models/client'
import Fournisseur from '#models/fournisseur'
import Reglement from '#models/reglement'
import { roundMoney } from '#services/pricing_service'
import {
  assertCaisseOuverte,
  enregistrerEntree as caisseEntree,
  enregistrerSortie as caisseSortie,
} from '#services/caisse_service'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

export class ReglementBusinessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReglementBusinessError'
  }
}

type ReglementBaseInput = {
  montant: number
  mode_paiement: 'especes' | 'cheque' | 'virement' | 'mobile_money' | 'carte'
  date_reglement: DateTime
  reference_externe?: string | null
  notes?: string | null
}

export type ReglementClientInput = ReglementBaseInput & {
  client_id: number
}

export type ReglementFournisseurInput = ReglementBaseInput & {
  fournisseur_id: number
}

/**
 * Applique le mouvement caisse espèces lié au règlement.
 * Montant > 0 → entrée caisse, montant < 0 → sortie caisse (valeur absolue).
 */
async function appliquerMouvementCaisseEspeces(
  pointDeVenteId: number,
  montantCaisse: number,
  motif: 'reglement_client' | 'reglement_fournisseur',
  libelle: string,
  reglementId: number,
  userId: number,
  trx: TransactionClientContract,
  notes: string | null
) {
  if (montantCaisse === 0) return

  await assertCaisseOuverte(pointDeVenteId, trx)

  const reference = { referenceId: reglementId, referenceType: 'reglement' }

  if (montantCaisse > 0) {
    await caisseEntree(pointDeVenteId, montantCaisse, motif, libelle, reference, userId, trx, notes)
    return
  }

  await caisseSortie(
    pointDeVenteId,
    Math.abs(montantCaisse),
    motif,
    libelle,
    reference,
    userId,
    trx,
    notes
  )
}

export async function enregistrerReglementClient(
  data: ReglementClientInput,
  userId: number,
  pointDeVenteId: number
) {
  if (data.montant === 0) {
    throw new ReglementBusinessError('Le montant du règlement ne peut pas être zéro')
  }

  return Reglement.transaction(async (trx) => {
    await assertCaisseOuverte(pointDeVenteId, trx)

    const client = await Client.query({ client: trx })
      .where('id', data.client_id)
      .where('point_de_vente_id', pointDeVenteId)
      .where('is_active', true)
      .forUpdate()
      .first()

    if (!client) throw new ReglementBusinessError('Client introuvable')

    const soldeAvant = Number(client.solde)
    const soldeApres = roundMoney(soldeAvant - data.montant)

    const reglement = await Reglement.create(
      {
        type: 'client',
        pointDeVenteId,
        clientId: client.id,
        fournisseurId: null,
        montant: data.montant,
        soldeAvant,
        soldeApres,
        modePaiement: data.mode_paiement,
        dateReglement: data.date_reglement,
        referenceExterne: data.reference_externe ?? null,
        userId,
        notes: data.notes ?? null,
      },
      { client: trx }
    )

    client.solde = soldeApres
    client.useTransaction(trx)
    await client.save()

    if (data.mode_paiement === 'especes') {
      await appliquerMouvementCaisseEspeces(
        pointDeVenteId,
        data.montant,
        'reglement_client',
        `Règlement client ${client.nom} (${client.code})`,
        reglement.id,
        userId,
        trx,
        data.notes ?? null
      )
    }

    return { reglement, client }
  })
}

export async function enregistrerReglementFournisseur(
  data: ReglementFournisseurInput,
  userId: number,
  pointDeVenteId: number
) {
  if (data.montant === 0) {
    throw new ReglementBusinessError('Le montant du règlement ne peut pas être zéro')
  }

  return Reglement.transaction(async (trx) => {
    await assertCaisseOuverte(pointDeVenteId, trx)

    const fournisseur = await Fournisseur.query({ client: trx })
      .where('id', data.fournisseur_id)
      .where('is_active', true)
      .forUpdate()
      .first()

    if (!fournisseur) throw new ReglementBusinessError('Fournisseur introuvable')

    const soldeAvant = Number(fournisseur.solde)
    const soldeApres = roundMoney(soldeAvant - data.montant)

    const reglement = await Reglement.create(
      {
        type: 'fournisseur',
        pointDeVenteId,
        clientId: null,
        fournisseurId: fournisseur.id,
        montant: data.montant,
        soldeAvant,
        soldeApres,
        modePaiement: data.mode_paiement,
        dateReglement: data.date_reglement,
        referenceExterne: data.reference_externe ?? null,
        userId,
        notes: data.notes ?? null,
      },
      { client: trx }
    )

    fournisseur.solde = soldeApres
    fournisseur.useTransaction(trx)
    await fournisseur.save()

    if (data.mode_paiement === 'especes') {
      await appliquerMouvementCaisseEspeces(
        pointDeVenteId,
        -data.montant,
        'reglement_fournisseur',
        `Règlement fournisseur ${fournisseur.nom} (${fournisseur.code})`,
        reglement.id,
        userId,
        trx,
        data.notes ?? null
      )
    }

    return { reglement, fournisseur }
  })
}
