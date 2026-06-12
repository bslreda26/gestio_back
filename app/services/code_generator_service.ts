import db from '@adonisjs/lucid/services/db'

function padNumber(num: number, size: number): string {
  return String(num).padStart(size, '0')
}

async function nextSequence(
  table: string,
  column: string,
  prefix: string,
  pointDeVenteId?: number
): Promise<number> {
  let query = db.from(table).where(column, 'like', `${prefix}%`)

  if (pointDeVenteId !== undefined) {
    query = query.where('point_de_vente_id', pointDeVenteId)
  }

  const row = await query.orderBy(column, 'desc').select(column).first()

  if (!row) return 1

  const code = row[column] as string
  const match = code.match(/(\d+)$/)
  return match ? Number(match[1]) + 1 : 1
}

export async function generateClientCode(pointDeVenteId: number): Promise<string> {
  const seq = await nextSequence('clients', 'code', 'CLI-', pointDeVenteId)
  return `CLI-${padNumber(seq, 4)}`
}

export async function generateFournisseurCode(): Promise<string> {
  const seq = await nextSequence('fournisseurs', 'code', 'FRN-')
  return `FRN-${padNumber(seq, 4)}`
}

export async function generateProduitCode(pointDeVenteId: number): Promise<string> {
  const seq = await nextSequence('produits', 'code', 'PRD-', pointDeVenteId)
  return `PRD-${padNumber(seq, 4)}`
}

export async function generateVenteNumero(
  statut: 'devis' | 'non_valide',
  posCode: string
): Promise<string> {
  const year = new Date().getFullYear()
  const type = statut === 'devis' ? 'DEV' : 'FAC'
  const prefix = `${posCode}-${type}-${year}-`
  const seq = await nextSequence('ventes', 'numero', prefix)
  return `${prefix}${padNumber(seq, 4)}`
}

export async function generateAchatNumero(posCode: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `${posCode}-ACH-${year}-`
  const seq = await nextSequence('achats', 'numero', prefix)
  return `${prefix}${padNumber(seq, 4)}`
}

export async function generateRetourNumero(posCode: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `${posCode}-RET-${year}-`
  const seq = await nextSequence('ventes', 'numero', prefix)
  return `${prefix}${padNumber(seq, 4)}`
}

export async function generateAchatRetourNumero(posCode: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `${posCode}-AVR-${year}-`
  const seq = await nextSequence('achats', 'numero', prefix)
  return `${prefix}${padNumber(seq, 4)}`
}
