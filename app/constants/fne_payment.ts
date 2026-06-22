/** Mode de paiement FNE (facture normalisée) — distinct des règlements client. */
export const FNE_PAYMENT_METHOD = {
  CASH: 'cash',
  DEFERRED: 'deferred',
} as const

export type FnePaymentMethod = (typeof FNE_PAYMENT_METHOD)[keyof typeof FNE_PAYMENT_METHOD]

export const FNE_PAYMENT_METHOD_DEFAULT: FnePaymentMethod = FNE_PAYMENT_METHOD.DEFERRED
