import Caisse from '#models/caisse'
import CaisseMouvement from '#models/caisse_mouvement'
import CaisseSession from '#models/caisse_session'
import Depense from '#models/depense'
import PointDeVente from '#models/point_de_vente'
import { buildMeta, parsePagination } from '#helpers/pagination'
import { roundMoney } from '#services/pricing_service'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

export class CaisseBusinessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CaisseBusinessError'
  }
}

type CaisseReference = {
  referenceId?: number
  referenceType?: string
}

type MouvementMotif =
  | 'vente_especes'
  | 'retour_especes'
  | 'achat_especes'
  | 'retour_achat_especes'
  | 'depense'
  | 'entree_manuelle'
  | 'ajustement'
  | 'ouverture'
  | 'annulation'
  | 'reglement_client'
  | 'reglement_fournisseur'

export type EntreeManuelleInput = {
  libelle: string
  montant: number
  caisseId?: number
  notes?: string | null
}

export type DepenseInput = {
  libelle: string
  categorie: 'transport' | 'fournitures' | 'salaire' | 'loyer' | 'autre'
  montant: number
  dateDepense: DateTime
  caisseId?: number
  notes?: string | null
}

export type HistoriqueFilters = {
  page?: number
  limit?: number
  type?: 'entree' | 'sortie'
  motif?: string
  designation?: string
  dateFrom?: DateTime
  dateTo?: DateTime
  caisseSessionId?: number
}

export type SessionFilters = {
  page?: number
  limit?: number
  statut?: 'ouverte' | 'fermee'
  dateFrom?: DateTime
  dateTo?: DateTime
  userOuvertureId?: number
}

function applySessionDateFilters(
  query: ReturnType<typeof CaisseSession.query>,
  dateFrom?: DateTime,
  dateTo?: DateTime
) {
  if (dateFrom && dateTo) {
    query
      .where('date_ouverture', '<=', dateTo.endOf('day').toSQL()!)
      .where((group) => {
        group.whereNull('date_fermeture').orWhere('date_fermeture', '>=', dateFrom.startOf('day').toSQL()!)
      })
  } else if (dateFrom) {
    query.where((group) => {
      group.whereNull('date_fermeture').orWhere('date_fermeture', '>=', dateFrom.startOf('day').toSQL()!)
    })
  } else if (dateTo) {
    query.where('date_ouverture', '<=', dateTo.endOf('day').toSQL()!)
  }
}

async function ensureCaisseForPointDeVente(
  pointDeVenteId: number,
  trx?: TransactionClientContract
) {
  const pdvQuery = trx ? PointDeVente.query({ client: trx }) : PointDeVente.query()
  const pdv = await pdvQuery.where('id', pointDeVenteId).first()
  if (!pdv) throw new CaisseBusinessError('Point de vente introuvable')

  return Caisse.create(
    {
      nom: `Caisse ${pdv.nom}`,
      soldeActuel: 0,
      isActive: true,
      pointDeVenteId,
    },
    trx ? { client: trx } : undefined
  )
}

export async function getCaisseForPointDeVente(
  pointDeVenteId: number,
  trx?: TransactionClientContract
) {
  const query = trx ? Caisse.query({ client: trx }) : Caisse.query()
  const caisse = await query
    .where('is_active', true)
    .where('point_de_vente_id', pointDeVenteId)
    .first()
  if (!caisse) {
    return ensureCaisseForPointDeVente(pointDeVenteId, trx)
  }
  return caisse
}

export async function getSessionCourante(
  pointDeVenteId: number,
  caisseId?: number,
  trx?: TransactionClientContract
) {
  const caisse = caisseId
    ? trx
      ? await Caisse.query({ client: trx }).where('id', caisseId).firstOrFail()
      : await Caisse.findOrFail(caisseId)
    : await getCaisseForPointDeVente(pointDeVenteId, trx)

  const query = trx
    ? CaisseSession.query({ client: trx })
    : CaisseSession.query()

  return query
    .where('caisse_id', caisse.id)
    .where('statut', 'ouverte')
    .orderBy('date_ouverture', 'desc')
    .first()
}

export async function assertCaisseOuverte(
  pointDeVenteId: number,
  trx?: TransactionClientContract,
  caisseId?: number
) {
  const session = await getSessionCourante(pointDeVenteId, caisseId, trx)
  if (!session) {
    throw new CaisseBusinessError(
      'La caisse n\'est pas ouverte. Ouvrez la caisse avant d\'enregistrer une opération espèces.'
    )
  }
  return session
}

export async function getSolde(pointDeVenteId: number, caisseId?: number) {
  const caisse = caisseId
    ? await Caisse.findOrFail(caisseId)
    : await getCaisseForPointDeVente(pointDeVenteId)
  const session = await getSessionCourante(pointDeVenteId, caisse.id)

  return {
    caisseId: caisse.id,
    nom: caisse.nom,
    soldeActuel: Number(caisse.soldeActuel),
    sessionOuverte: session
      ? {
          id: session.id,
          montantOuverture: Number(session.montantOuverture),
          dateOuverture: session.dateOuverture.toISO(),
          userOuvertureId: session.userOuvertureId,
        }
      : null,
  }
}

async function enregistrerMouvement(
  caisse: Caisse,
  type: 'entree' | 'sortie',
  motif: MouvementMotif,
  montant: number,
  libelle: string,
  reference: CaisseReference,
  userId: number,
  trx?: TransactionClientContract,
  notes: string | null = null,
  caisseSessionId?: number | null
) {
  const soldeAvant = Number(caisse.soldeActuel)
  const soldeApres = type === 'entree' ? soldeAvant + montant : soldeAvant - montant

  let sessionId = caisseSessionId
  if (sessionId === undefined) {
    const session = await getSessionCourante(caisse.pointDeVenteId, caisse.id, trx)
    if (!session) {
      throw new CaisseBusinessError(
        'La caisse n\'est pas ouverte. Ouvrez la caisse avant d\'enregistrer une opération espèces.'
      )
    }
    sessionId = session.id
  }

  const mouvement = await CaisseMouvement.create(
    {
      caisseId: caisse.id,
      caisseSessionId: sessionId,
      type,
      motif,
      montant,
      soldeAvant,
      soldeApres,
      referenceId: reference.referenceId ?? null,
      referenceType: reference.referenceType ?? null,
      libelle,
      userId,
      dateMouvement: DateTime.now(),
      notes,
      createdAt: DateTime.now(),
    },
    trx ? { client: trx } : undefined
  )

  caisse.soldeActuel = soldeApres
  if (trx) caisse.useTransaction(trx)
  await caisse.save()

  return { soldeAvant, soldeApres, mouvement }
}

export async function enregistrerEntree(
  pointDeVenteId: number,
  montant: number,
  motif: MouvementMotif,
  libelle: string,
  reference: CaisseReference,
  userId: number,
  trx?: TransactionClientContract,
  notes: string | null = null,
  caisseId?: number
) {
  const caisse = caisseId
    ? await Caisse.findOrFail(caisseId)
    : await getCaisseForPointDeVente(pointDeVenteId, trx)
  return enregistrerMouvement(caisse, 'entree', motif, montant, libelle, reference, userId, trx, notes)
}

export async function enregistrerSortie(
  pointDeVenteId: number,
  montant: number,
  motif: MouvementMotif,
  libelle: string,
  reference: CaisseReference,
  userId: number,
  trx?: TransactionClientContract,
  notes: string | null = null,
  caisseId?: number
) {
  const caisse = caisseId
    ? await Caisse.findOrFail(caisseId)
    : await getCaisseForPointDeVente(pointDeVenteId, trx)
  return enregistrerMouvement(caisse, 'sortie', motif, montant, libelle, reference, userId, trx, notes)
}

export async function creerDepense(
  data: DepenseInput,
  userId: number,
  pointDeVenteId: number,
  trx?: TransactionClientContract
) {
  const { assertDepenseCategorieActive } = await import('#services/depense_categorie_service')
  await assertDepenseCategorieActive(data.categorie)

  const run = async (client: TransactionClientContract) => {
    const caisse = data.caisseId
      ? await Caisse.query({ client }).where('id', data.caisseId).firstOrFail()
      : await getCaisseForPointDeVente(pointDeVenteId, client)

    const depense = await Depense.create(
      {
        caisseId: caisse.id,
        pointDeVenteId,
        libelle: data.libelle,
        categorie: data.categorie,
        montant: data.montant,
        dateDepense: data.dateDepense,
        userId,
        notes: data.notes ?? null,
      },
      { client }
    )

    await enregistrerMouvement(
      caisse,
      'sortie',
      'depense',
      data.montant,
      data.libelle,
      { referenceId: depense.id, referenceType: 'depense' },
      userId,
      client,
      data.notes ?? null
    )

    return depense
  }

  if (trx) return run(trx)
  return Depense.transaction(run)
}

export async function creerEntreeManuelle(
  data: EntreeManuelleInput,
  userId: number,
  pointDeVenteId: number,
  trx?: TransactionClientContract
) {
  if (data.montant <= 0) {
    throw new CaisseBusinessError('Le montant doit être positif')
  }

  const run = async (client: TransactionClientContract) => {
    const caisse = data.caisseId
      ? await Caisse.query({ client }).where('id', data.caisseId).firstOrFail()
      : await getCaisseForPointDeVente(pointDeVenteId, client)

    const { mouvement, soldeApres } = await enregistrerMouvement(
      caisse,
      'entree',
      'entree_manuelle',
      data.montant,
      data.libelle,
      {},
      userId,
      client,
      data.notes ?? null
    )

    return { caisse, mouvement, soldeApres }
  }

  if (trx) return run(trx)
  return Caisse.transaction(run)
}

export async function getHistorique(
  pointDeVenteId: number,
  caisseId: number | undefined,
  filters: HistoriqueFilters = {}
) {
  const { page, limit, offset } = parsePagination(filters)
  const caisse = caisseId
    ? await Caisse.findOrFail(caisseId)
    : await getCaisseForPointDeVente(pointDeVenteId)

  const query = CaisseMouvement.query()
    .where('caisse_id', caisse.id)
    .orderBy('date_mouvement', 'desc')

  if (filters.type) query.where('type', filters.type)
  if (filters.motif) query.where('motif', filters.motif)
  if (filters.designation) query.whereILike('libelle', `%${filters.designation}%`)
  if (filters.caisseSessionId) query.where('caisse_session_id', filters.caisseSessionId)
  if (filters.dateFrom) query.where('date_mouvement', '>=', filters.dateFrom.startOf('day').toSQL()!)
  if (filters.dateTo) query.where('date_mouvement', '<=', filters.dateTo.endOf('day').toSQL()!)

  const total = await query.clone().count('* as total')
  const totalCount = Number(total[0].$extras.total)
  const data = await query.offset(offset).limit(limit)

  return {
    data,
    meta: buildMeta(totalCount, page, limit),
    caisse: { id: caisse.id, nom: caisse.nom, soldeActuel: Number(caisse.soldeActuel) },
  }
}

export async function getMouvement(mouvementId: number) {
  const mouvement = await CaisseMouvement.find(mouvementId)
  if (!mouvement) throw new CaisseBusinessError('Mouvement caisse introuvable')
  const caisse = await Caisse.find(mouvement.caisseId)
  return { mouvement, caisse }
}

export async function ouvertureCaisse(
  pointDeVenteId: number,
  montant: number,
  userId: number,
  notes?: string | null,
  caisseId?: number
) {
  if (montant < 0) throw new CaisseBusinessError('Le montant d\'ouverture ne peut pas être négatif')

  return Caisse.transaction(async (trx) => {
    const caisse = caisseId
      ? await Caisse.query({ client: trx }).where('id', caisseId).firstOrFail()
      : await getCaisseForPointDeVente(pointDeVenteId, trx)

    const sessionOuverte = await getSessionCourante(pointDeVenteId, caisse.id, trx)
    if (sessionOuverte) {
      throw new CaisseBusinessError('Une session caisse est déjà ouverte. Fermez-la avant d\'en ouvrir une nouvelle.')
    }

    const now = DateTime.now()
    const session = await CaisseSession.create(
      {
        caisseId: caisse.id,
        pointDeVenteId,
        userOuvertureId: userId,
        userFermetureId: null,
        montantOuverture: montant,
        montantFermeture: null,
        soldeTheorique: null,
        ecart: null,
        statut: 'ouverte',
        dateOuverture: now,
        dateFermeture: null,
        notesOuverture: notes ?? null,
        notesFermeture: null,
        createdAt: now,
      },
      { client: trx }
    )

    if (montant > 0) {
      await enregistrerMouvement(
        caisse,
        'entree',
        'ouverture',
        montant,
        'Ouverture caisse',
        {},
        userId,
        trx,
        notes ?? null,
        session.id
      )
    }

    return { caisse, session }
  })
}

export async function fermetureCaisse(
  pointDeVenteId: number,
  montantFermeture: number,
  userId: number,
  notes?: string | null,
  caisseId?: number
) {
  if (montantFermeture < 0) {
    throw new CaisseBusinessError('Le montant de fermeture ne peut pas être négatif')
  }

  return Caisse.transaction(async (trx) => {
    const caisse = caisseId
      ? await Caisse.query({ client: trx }).where('id', caisseId).firstOrFail()
      : await getCaisseForPointDeVente(pointDeVenteId, trx)

    const session = await getSessionCourante(pointDeVenteId, caisse.id, trx)
    if (!session) {
      throw new CaisseBusinessError('Aucune session caisse ouverte à fermer')
    }

    const soldeTheorique = Number(caisse.soldeActuel)
    const ecart = roundMoney(montantFermeture - soldeTheorique)

    if (ecart > 0) {
      await enregistrerMouvement(
        caisse,
        'entree',
        'ajustement',
        ecart,
        'Ajustement fermeture caisse (surplus)',
        {},
        userId,
        trx,
        notes ?? null,
        session.id
      )
    } else if (ecart < 0) {
      await enregistrerMouvement(
        caisse,
        'sortie',
        'ajustement',
        Math.abs(ecart),
        'Ajustement fermeture caisse (manquant)',
        {},
        userId,
        trx,
        notes ?? null,
        session.id
      )
    }

    const now = DateTime.now()
    session.merge({
      userFermetureId: userId,
      montantFermeture,
      soldeTheorique,
      ecart,
      statut: 'fermee',
      dateFermeture: now,
      notesFermeture: notes ?? null,
    })
    session.useTransaction(trx)
    await session.save()

    await caisse.refresh()
    return { caisse, session }
  })
}

async function getSessionsMovementTotals(sessionIds: number[]) {
  const map = new Map<number, { totalEntrees: number; totalSorties: number }>()
  if (!sessionIds.length) return map

  const mouvements = await CaisseMouvement.query().whereIn('caisse_session_id', sessionIds)

  for (const m of mouvements) {
    const sessionId = m.caisseSessionId
    if (!sessionId) continue
    if (!map.has(sessionId)) map.set(sessionId, { totalEntrees: 0, totalSorties: 0 })
    const totals = map.get(sessionId)!
    const montant = Number(m.montant)
    if (m.type === 'entree') totals.totalEntrees += montant
    else totals.totalSorties += montant
  }

  for (const [sessionId, totals] of map) {
    map.set(sessionId, {
      totalEntrees: roundMoney(totals.totalEntrees),
      totalSorties: roundMoney(totals.totalSorties),
    })
  }

  return map
}

async function buildSessionSummary(session: CaisseSession) {
  const mouvements = await CaisseMouvement.query()
    .where('caisse_session_id', session.id)
    .orderBy('date_mouvement', 'asc')

  let totalEntrees = 0
  let totalSorties = 0

  for (const m of mouvements) {
    const montant = Number(m.montant)
    if (m.type === 'entree') totalEntrees += montant
    else totalSorties += montant
  }

  return {
    session,
    mouvements,
    totaux: {
      totalEntrees: roundMoney(totalEntrees),
      totalSorties: roundMoney(totalSorties),
      nombreMouvements: mouvements.length,
    },
  }
}

export async function getSessionCouranteDetail(pointDeVenteId: number, caisseId?: number) {
  const session = await getSessionCourante(pointDeVenteId, caisseId)
  if (!session) return null
  return buildSessionSummary(session)
}

export async function getSession(sessionId: number) {
  const session = await CaisseSession.find(sessionId)
  if (!session) throw new CaisseBusinessError('Session caisse introuvable')
  const caisse = await Caisse.find(session.caisseId)
  const summary = await buildSessionSummary(session)
  return { ...summary, caisse }
}

export async function searchSessions(
  pointDeVenteId: number,
  caisseId: number | undefined,
  filters: SessionFilters = {}
) {
  const { page, limit, offset } = parsePagination(filters)
  const caisse = caisseId
    ? await Caisse.findOrFail(caisseId)
    : await getCaisseForPointDeVente(pointDeVenteId)

  const query = CaisseSession.query()
    .where('caisse_id', caisse.id)
    .orderBy('date_ouverture', 'desc')

  if (filters.statut) query.where('statut', filters.statut)
  if (filters.userOuvertureId) query.where('user_ouverture_id', filters.userOuvertureId)
  applySessionDateFilters(query, filters.dateFrom, filters.dateTo)

  const total = await query.clone().count('* as total')
  const totalCount = Number(total[0].$extras.total)
  const sessions = await query.offset(offset).limit(limit)
  const totalsMap = await getSessionsMovementTotals(sessions.map((s) => s.id))

  const data = sessions.map((session) => {
    const totals = totalsMap.get(session.id) ?? { totalEntrees: 0, totalSorties: 0 }
    return {
      ...session.serialize(),
      totalEntrees: totals.totalEntrees,
      totalSorties: totals.totalSorties,
    }
  })

  return {
    data,
    meta: buildMeta(totalCount, page, limit),
    caisse: { id: caisse.id, nom: caisse.nom, soldeActuel: Number(caisse.soldeActuel) },
  }
}

export type DepenseUpdateInput = {
  libelle?: string
  categorie?: DepenseInput['categorie']
  montant?: number
  dateDepense?: DateTime
  notes?: string | null
}

export async function mettreAJourDepense(
  depenseId: number,
  data: DepenseUpdateInput,
  userId: number
) {
  if (data.categorie) {
    const { assertDepenseCategorieActive } = await import('#services/depense_categorie_service')
    await assertDepenseCategorieActive(data.categorie)
  }

  return Depense.transaction(async (trx) => {
    const depense = await Depense.query({ client: trx }).where('id', depenseId).forUpdate().firstOrFail()
    const oldMontant = Number(depense.montant)
    const newMontant = data.montant !== undefined ? data.montant : oldMontant

    if (newMontant <= 0) throw new CaisseBusinessError('Le montant doit être positif')

    const delta = roundMoney(newMontant - oldMontant)

    if (delta !== 0) {
      const caisse = await Caisse.query({ client: trx }).where('id', depense.caisseId).firstOrFail()
      const libelle = `Ajustement dépense: ${data.libelle ?? depense.libelle}`

      if (delta > 0) {
        await enregistrerMouvement(
          caisse,
          'sortie',
          'depense',
          delta,
          libelle,
          { referenceId: depense.id, referenceType: 'depense' },
          userId,
          trx,
          data.notes ?? depense.notes
        )
      } else {
        await enregistrerMouvement(
          caisse,
          'entree',
          'annulation',
          Math.abs(delta),
          libelle,
          { referenceId: depense.id, referenceType: 'depense' },
          userId,
          trx,
          data.notes ?? depense.notes
        )
      }
    }

    depense.merge({
      libelle: data.libelle ?? depense.libelle,
      categorie: data.categorie ?? depense.categorie,
      montant: newMontant,
      dateDepense: data.dateDepense ?? depense.dateDepense,
      notes: data.notes !== undefined ? data.notes : depense.notes,
    })
    depense.useTransaction(trx)
    await depense.save()

    return depense
  })
}

export async function supprimerDepense(depenseId: number, userId: number) {
  return Depense.transaction(async (trx) => {
    const depense = await Depense.query({ client: trx }).where('id', depenseId).forUpdate().firstOrFail()
    const caisse = await Caisse.query({ client: trx }).where('id', depense.caisseId).firstOrFail()

    await enregistrerMouvement(
      caisse,
      'entree',
      'annulation',
      Number(depense.montant),
      `Annulation dépense: ${depense.libelle}`,
      { referenceId: depense.id, referenceType: 'depense' },
      userId,
      trx,
      depense.notes
    )

    depense.useTransaction(trx)
    await depense.delete()

    return { id: depenseId, message: 'Dépense supprimée — mouvement caisse annulé' }
  })
}
