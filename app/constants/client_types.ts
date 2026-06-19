export const CLIENT_TYPES = ['B2B', 'B2C', 'B2F', 'B2G'] as const
export type ClientType = (typeof CLIENT_TYPES)[number]

export const FNE_INVOICE_TEMPLATES = ['B2B', 'B2C', 'B2F', 'B2G'] as const
export type FneInvoiceTemplate = (typeof FNE_INVOICE_TEMPLATES)[number]

/** Libellés affichage — B2F = export, B2G = gouvernement */
export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  B2B: 'Entreprise (B2B)',
  B2C: 'Particulier (B2C)',
  B2F: 'Export (B2F)',
  B2G: 'Gouvernement (B2G)',
}

/** Types client exigeant un NCC pour la certification FNE */
export const CLIENT_TYPES_REQUIRING_NCC: ClientType[] = ['B2B', 'B2G']

export function resolveFneTemplate(clientType: ClientType | string | null | undefined): FneInvoiceTemplate {
  if (clientType === 'B2B' || clientType === 'B2C' || clientType === 'B2F' || clientType === 'B2G') {
    return clientType
  }
  return 'B2C'
}

export function clientTypeRequiresNcc(clientType: ClientType | string | null | undefined): boolean {
  return CLIENT_TYPES_REQUIRING_NCC.includes(clientType as ClientType)
}
