import { isLockableVente } from '#constants/vente_statuts'
import User from '#models/user'
import Vente from '#models/vente'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

/** Lock duration — renewed by heartbeat or on re-acquire by same user */
export const VENTE_LOCK_TTL_MINUTES = 5

export type VenteLockHolder = {
  id: number
  nom: string | null
  prenom: string | null
  email: string
}

export type VenteLockInfo = {
  is_locked: boolean
  locked_by: VenteLockHolder | null
  locked_at: string | null
  lock_expires_at: string | null
  is_locked_by_me: boolean
}

export class VenteLockError extends Error {
  constructor(
    message: string,
    public readonly lockedBy?: VenteLockHolder
  ) {
    super(message)
    this.name = 'VenteLockError'
  }
}

function isLockActive(vente: Vente): boolean {
  if (!vente.lockedByUserId || !vente.lockExpiresAt) return false
  return vente.lockExpiresAt > DateTime.now()
}

function lockExpiry(): DateTime {
  return DateTime.now().plus({ minutes: VENTE_LOCK_TTL_MINUTES })
}

async function loadLockHolder(userId: number): Promise<VenteLockHolder | null> {
  const user = await User.find(userId)
  if (!user) return null
  return { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email }
}

export async function buildVenteLockInfo(
  vente: Vente,
  currentUserId?: number
): Promise<VenteLockInfo> {
  if (!isLockActive(vente)) {
    return {
      is_locked: false,
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      is_locked_by_me: false,
    }
  }

  const holder = await loadLockHolder(vente.lockedByUserId!)
  return {
    is_locked: true,
    locked_by: holder,
    locked_at: vente.lockedAt?.toISO() ?? null,
    lock_expires_at: vente.lockExpiresAt?.toISO() ?? null,
    is_locked_by_me: currentUserId !== undefined && vente.lockedByUserId === currentUserId,
  }
}

function assertLockableStatut(vente: Vente) {
  if (!isLockableVente(vente.statut)) {
    throw new VenteLockError('Ce document ne peut pas être verrouillé pour édition')
  }
}

/**
 * Acquire or renew edit lock when opening a vente/devis/facture screen.
 * Second user gets 409 while lock is active.
 */
export async function acquireVenteLock(venteId: number, userId: number): Promise<VenteLockInfo> {
  return db.transaction(async (trx) => {
    const vente = await Vente.query({ client: trx }).where('id', venteId).forUpdate().first()
    if (!vente) throw new VenteLockError('Vente introuvable')

    assertLockableStatut(vente)

    if (isLockActive(vente) && vente.lockedByUserId !== userId) {
      const holder = await loadLockHolder(vente.lockedByUserId!)
      const name = holder
        ? `${holder.prenom ?? ''} ${holder.nom ?? ''}`.trim() || holder.email
        : 'un autre utilisateur'
      throw new VenteLockError(
        `Ce document est déjà ouvert par ${name}. Fermez la fenêtre ou attendez la fin du verrou.`,
        holder ?? undefined
      )
    }

    const now = DateTime.now()
    vente.lockedByUserId = userId
    vente.lockedAt = now
    vente.lockExpiresAt = lockExpiry()
    vente.useTransaction(trx)
    await vente.save()

    return buildVenteLockInfo(vente, userId)
  })
}

/** Heartbeat — call every ~2 min while edit screen is open */
export async function renewVenteLock(venteId: number, userId: number): Promise<VenteLockInfo> {
  return db.transaction(async (trx) => {
    const vente = await Vente.query({ client: trx }).where('id', venteId).forUpdate().first()
    if (!vente) throw new VenteLockError('Vente introuvable')

    assertLockableStatut(vente)

    if (!isLockActive(vente) || vente.lockedByUserId !== userId) {
      throw new VenteLockError(
        'Verrou expiré ou détenu par un autre utilisateur. Rouvrez le document.'
      )
    }

    vente.lockExpiresAt = lockExpiry()
    vente.useTransaction(trx)
    await vente.save()

    return buildVenteLockInfo(vente, userId)
  })
}

/** Release lock when closing the edit window */
export async function releaseVenteLock(
  venteId: number,
  userId: number,
  options?: { force?: boolean; isAdmin?: boolean }
): Promise<void> {
  await db.transaction(async (trx) => {
    const vente = await Vente.query({ client: trx }).where('id', venteId).forUpdate().first()
    if (!vente) throw new VenteLockError('Vente introuvable')

    if (!vente.lockedByUserId) return

    const isOwner = vente.lockedByUserId === userId
    const canForce = options?.force === true && options?.isAdmin === true

    if (!isOwner && !canForce) {
      throw new VenteLockError('Seul le détenteur du verrou ou un administrateur peut le libérer')
    }

    vente.lockedByUserId = null
    vente.lockedAt = null
    vente.lockExpiresAt = null
    vente.useTransaction(trx)
    await vente.save()
  })
}

/** Required before any mutation on an open document */
export async function assertVenteLockHeld(venteId: number, userId: number): Promise<void> {
  const vente = await Vente.find(venteId)
  if (!vente) throw new VenteLockError('Vente introuvable')

  if (!isLockActive(vente) || vente.lockedByUserId !== userId) {
    throw new VenteLockError(
      'Vous devez ouvrir ce document (verrou) avant de le modifier. Un autre utilisateur peut l\'avoir ouvert.'
    )
  }
}

export async function clearVenteLock(venteId: number): Promise<void> {
  const vente = await Vente.find(venteId)
  if (!vente) return

  vente.lockedByUserId = null
  vente.lockedAt = null
  vente.lockExpiresAt = null
  await vente.save()
}
