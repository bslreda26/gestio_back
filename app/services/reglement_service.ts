import Client from '#models/client'
import Fournisseur from '#models/fournisseur'
import Reglement from '#models/reglement'
import { roundMoney } from '#services/pricing_service'
import { adjustFournisseurSoldePdv } from '#services/fournisseur_solde_service'
import {
  assertCaisseOuverte,
  enregistrerEntree as caisseEntree,
  enregistrerSortie as caisseSortie,
} from '#services/caisse_service'
import db from '@adonisjs/lucid/services/db'
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

export type ReglementClientTrxInput = ReglementClientInput & {
  vente_id?: number | null
  paiement_id?: number | null
  caisse_motif?: 'reglement_client' | 'vente_especes' | 'retour_especes'
  caisse_libelle?: string
}

type CaisseMotifReglement =
  | 'reglement_client'
  | 'vente_especes'
  | 'retour_especes'
  | 'reglement_fournisseur'

/**
 * Applique le mouvement caisse espèces lié au règlement.
 * Montant > 0 → entrée caisse, montant < 0 → sortie caisse (valeur absolue).
 */
async function appliquerMouvementCaisseEspeces(
  pointDeVenteId: number,
  montantCaisse: number,
  motif: CaisseMotifReglement,
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

export async function enregistrerReglementClientDansTransaction(
  data: ReglementClientTrxInput,
  userId: number,
  pointDeVenteId: number,
  trx: TransactionClientContract
) {
  if (data.montant === 0) {
    throw new ReglementBusinessError('Le montant du règlement ne peut pas être zéro')
  }

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
      venteId: data.vente_id ?? null,
      paiementId: data.paiement_id ?? null,
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
    const motif = data.caisse_motif ?? 'reglement_client'
    const libelle =
      data.caisse_libelle ?? `Règlement client ${client.nom} (${client.code})`
    await appliquerMouvementCaisseEspeces(
      pointDeVenteId,
      data.montant,
      motif,
      libelle,
      reglement.id,
      userId,
      trx,
      data.notes ?? null
    )
  }

  return { reglement, client }
}

export async function enregistrerReglementClient(
  data: ReglementClientInput,
  userId: number,
  pointDeVenteId: number
) {
  return Reglement.transaction(async (trx) => {
    await assertCaisseOuverte(pointDeVenteId, trx)
    return enregistrerReglementClientDansTransaction(data, userId, pointDeVenteId, trx)
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

    const { soldeAvant, soldeApres } = await adjustFournisseurSoldePdv(
      fournisseur.id,
      pointDeVenteId,
      -data.montant,
      trx
    )

    const reglement = await Reglement.create(
      {
        type: 'fournisseur',
        pointDeVenteId,
        clientId: null,
        fournisseurId: fournisseur.id,
        venteId: null,
        paiementId: null,
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

    await fournisseur.refresh()

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

/** Crée des règlements client pour les paiements vente historiques (sans règlement lié). */
export async function backfillReglementsFromPaiementsVente() {
  const rows = await db
    .from('paiements as p')
    .join('ventes as v', 'p.reference_id', 'v.id')
    .leftJoin('reglements as r', 'r.paiement_id', 'p.id')
    .where('p.type', 'vente')
    .whereIn('v.statut', ['valide', 'non_valide', 'retour'])
    .whereNull('r.id')
    .select(
      'p.id as paiement_id',
      'p.montant',
      'p.mode_paiement',
      'p.date_paiement',
      'p.notes',
      'p.reference_paiement',
      'p.user_id',
      'v.id as vente_id',
      'v.numero as vente_numero',
      'v.statut as vente_statut',
      'v.client_id',
      'v.point_de_vente_id'
    )
    .orderBy('v.client_id', 'asc')
    .orderBy('v.point_de_vente_id', 'asc')
    .orderBy('p.date_paiement', 'asc')
    .orderBy('p.id', 'asc')

  const runningSolde = new Map<string, number>()

  for (const row of rows) {
    const key = `${row.client_id}:${row.point_de_vente_id}`
    if (!runningSolde.has(key)) {
      const { computeClientSoldePdv } = await import('#services/rapport_service')
      runningSolde.set(
        key,
        await computeClientSoldePdv(Number(row.client_id), Number(row.point_de_vente_id))
      )
    }

    const soldeAvant = runningSolde.get(key)!
    const montant =
      row.vente_statut === 'retour' ? -Number(row.montant) : Number(row.montant)
    const soldeApres = roundMoney(soldeAvant - montant)
    const now = new Date()

    await db.table('reglements').insert({
      type: 'client',
      point_de_vente_id: row.point_de_vente_id,
      client_id: row.client_id,
      fournisseur_id: null,
      vente_id: row.vente_id,
      paiement_id: row.paiement_id,
      montant,
      solde_avant: soldeAvant,
      solde_apres: soldeApres,
      mode_paiement: row.mode_paiement,
      date_reglement: row.date_paiement,
      reference_externe: row.vente_numero,
      user_id: row.user_id,
      notes: row.notes ?? row.reference_paiement ?? null,
      created_at: now,
      updated_at: now,
    })

    runningSolde.set(key, soldeApres)
  }

  if (rows.length > 0) {
    const { backfillClientSoldesFromMovements } = await import('#services/rapport_service')
    await backfillClientSoldesFromMovements()
  }
}
