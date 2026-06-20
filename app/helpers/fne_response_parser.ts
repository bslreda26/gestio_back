export type ParsedFneResponse = {
  statusCode: number | null
  invoiceId: string | null
  reference: string | null
  ncc: string | null
  token: string | null
  qrContent: string | null
  certifiedAt: string | null
  raw: Record<string, unknown> | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function deepFindString(root: unknown, keys: string[]): string | null {
  const queue: unknown[] = [root]
  const seen = new Set<unknown>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || seen.has(current)) continue
    seen.add(current)

    const record = asRecord(current)
    if (!record) continue

    for (const key of keys) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') queue.push(value)
    }
  }

  return null
}

function isFneErrorStatus(status: number | null): boolean {
  if (status === 500) return true
  if (status != null && status >= 400) return true
  return false
}

function certificationRecord(
  response: string | Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (typeof response === 'string') {
    try {
      return JSON.parse(response) as Record<string, unknown>
    } catch {
      return null
    }
  }
  return asRecord(response)
}

export function formatFneErrorMessage(response: Record<string, unknown>): string {
  const nestedErrors = asRecord(response.errors)
  if (nestedErrors) {
    const parts: string[] = []
    for (const fieldErrors of Object.values(nestedErrors)) {
      const record = asRecord(fieldErrors)
      if (record) {
        for (const msg of Object.values(record)) {
          if (typeof msg === 'string' && msg.trim()) parts.push(msg.trim())
        }
      } else if (typeof fieldErrors === 'string' && fieldErrors.trim()) {
        parts.push(fieldErrors.trim())
      }
    }
    if (parts.length) return parts.join('; ')
  }

  const message = response.message
  if (Array.isArray(message)) {
    const parts = message.filter((part) => typeof part === 'string' && part.trim())
    if (parts.length) return parts.join('; ')
  }
  if (typeof message === 'string' && message.trim()) return message.trim()
  const status = typeof response.statusCode === 'number' ? response.statusCode : null
  if (status != null) return `Erreur FNE (HTTP ${status})`
  return "La facture n'a pas été certifiée par la FNE"
}

export function resolveFneStoredInvoiceId(record: Record<string, unknown>): string | null {
  const invoice = asRecord(record.invoice)
  return pickString(record.invoiceId, invoice?.id, record.reference)
}

export function parseFneApiResponse(apiResponse: string | null | undefined): ParsedFneResponse | null {
  if (!apiResponse?.trim()) return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(apiResponse) as Record<string, unknown>
  } catch {
    return null
  }

  const invoice = asRecord(parsed.invoice)
  const token = pickString(
    parsed.token,
    parsed.verificationUrl,
    parsed.verification_url,
    parsed.qrCode,
    parsed.qrcode,
    invoice?.token,
    invoice?.verificationUrl,
    invoice?.verification_url,
    invoice?.qrCode,
    invoice?.qr_code,
    deepFindString(parsed, ['token', 'verificationUrl', 'verification_url', 'qrCode', 'qr_code'])
  )

  const reference = pickString(
    parsed.reference,
    parsed.fiscalReference,
    parsed.fiscal_reference,
    parsed.numeroFne,
    invoice?.reference,
    invoice?.fiscalReference,
    deepFindString(parsed, ['reference', 'fiscalReference', 'fiscal_reference'])
  )

  return {
    statusCode: typeof parsed.statusCode === 'number' ? parsed.statusCode : null,
    invoiceId: resolveFneStoredInvoiceId(parsed),
    reference,
    ncc: pickString(parsed.ncc, invoice?.ncc),
    token,
    qrContent: token ?? reference,
    certifiedAt: pickString(parsed.certifiedAt, invoice?.certifiedAt),
    raw: parsed,
  }
}

/** True when FNE returned a sale invoice id or a refund reference + token. */
export function isFneCertificationSuccessful(
  response: string | Record<string, unknown> | null | undefined
): boolean {
  const record = certificationRecord(response)
  if (!record) return false

  const status = typeof record.statusCode === 'number' ? record.statusCode : null
  if (isFneErrorStatus(status)) return false

  if (resolveFneStoredInvoiceId(record)) return true

  const invoice = asRecord(record.invoice)
  const token = pickString(
    record.token,
    invoice?.token,
    deepFindString(record, ['token', 'verificationUrl', 'verification_url'])
  )
  const reference = pickString(
    record.reference,
    invoice?.reference,
    deepFindString(record, ['reference', 'fiscalReference', 'fiscal_reference'])
  )

  return Boolean(reference && token)
}
