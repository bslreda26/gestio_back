export function maskSolde<T extends Record<string, unknown>>(record: T, canSeeSolde: boolean): T {
  if (canSeeSolde || !('solde' in record)) return record
  const { solde: _solde, ...rest } = record
  return rest as T
}
