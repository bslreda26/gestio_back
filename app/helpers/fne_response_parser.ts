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
    invoiceId: pickString(parsed.invoiceId, invoice?.id),
    reference,
    ncc: pickString(parsed.ncc, invoice?.ncc),
    token,
    qrContent: token ?? reference,
    certifiedAt: pickString(parsed.certifiedAt, invoice?.certifiedAt),
    raw: parsed,
  }
}

/** True when FNE returned an invoice id without an explicit HTTP-style error. */
export function isFneCertificationSuccessful(
  response: string | Record<string, unknown> | null | undefined
): boolean {
  let record: Record<string, unknown> | null = null

  if (typeof response === 'string') {
    const parsed = parseFneApiResponse(response)
    if (!parsed?.invoiceId) return false
    if (parsed.statusCode === 500) return false
    if (parsed.statusCode != null && parsed.statusCode >= 400) return false
    return true
  }

  record = asRecord(response)
  if (!record) return false

  const invoice = asRecord(record.invoice)
  const invoiceId = pickString(record.invoiceId, invoice?.id)
  if (!invoiceId) return false

  const status = typeof record.statusCode === 'number' ? record.statusCode : null
  if (status === 500) return false
  if (status != null && status >= 400) return false

  return true
}
