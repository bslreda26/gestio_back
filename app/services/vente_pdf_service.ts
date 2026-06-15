import type { VenteImpressionContext } from '#services/vente_impression_service'
import { statutPaiementLabel } from '#services/vente_impression_service'
import PDFDocument from 'pdfkit'

const PAGE_MARGIN = 45
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`
}

function formatQty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '')
}

function formatDate(value: { toFormat: (fmt: string) => string } | null | undefined): string {
  if (!value) return '-'
  return value.toFormat('dd/MM/yyyy')
}

function ascii(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?')
}

type PdfDoc = InstanceType<typeof PDFDocument>

function drawDivider(doc: PdfDoc, y: number) {
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y).strokeColor('#cccccc').stroke()
}

function drawPointDeVenteHeader(doc: PdfDoc, ctx: VenteImpressionContext, startY: number) {
  const pos = ctx.pointDeVente
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor('#111111')
    .text(ascii(pos.nom), PAGE_MARGIN, startY, { width: CONTENT_WIDTH * 0.65 })

  const badge = ctx.impression.label
  const badgeWidth = badge === 'DUPLICATA' ? 90 : 28
  doc
    .roundedRect(PAGE_MARGIN + CONTENT_WIDTH - badgeWidth, startY - 2, badgeWidth, 22, 4)
    .lineWidth(1)
    .strokeColor(ctx.impression.is_duplicata ? '#b45309' : '#2563eb')
    .stroke()
  doc
    .font('Helvetica-Bold')
    .fontSize(badge === 'DUPLICATA' ? 9 : 12)
    .fillColor(ctx.impression.is_duplicata ? '#b45309' : '#2563eb')
    .text(badge, PAGE_MARGIN + CONTENT_WIDTH - badgeWidth, startY + 4, {
      width: badgeWidth,
      align: 'center',
    })

  let y = startY + 22
  doc.font('Helvetica').fontSize(9).fillColor('#444444')

  if (pos.adresse) {
    doc.text(ascii(pos.adresse), PAGE_MARGIN, y, { width: CONTENT_WIDTH * 0.65 })
    y += 12
  }
  const villeTel = [pos.ville, pos.telephone ? `Tel: ${pos.telephone}` : null]
    .filter(Boolean)
    .join(' - ')
  if (villeTel) {
    doc.text(ascii(villeTel), PAGE_MARGIN, y, { width: CONTENT_WIDTH * 0.65 })
    y += 12
  }

  return y + 8
}

function drawDocumentTitle(doc: PdfDoc, ctx: VenteImpressionContext, y: number) {
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#111111')
    .text(ctx.documentTitle, PAGE_MARGIN, y, { align: 'center', width: CONTENT_WIDTH })
  return y + 28
}

function drawMetaBlock(doc: PdfDoc, ctx: VenteImpressionContext, y: number) {
  const vente = ctx.vente
  const client = ctx.client
  const leftX = PAGE_MARGIN
  const rightX = PAGE_MARGIN + CONTENT_WIDTH / 2 + 10
  const colWidth = CONTENT_WIDTH / 2 - 10

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text('Document', leftX, y)
  doc.font('Helvetica').fontSize(9).fillColor('#333333')
  let leftY = y + 14
  const docLines = [
    `Numero: ${vente.numero}`,
    `Date: ${formatDate(vente.dateVente)}`,
    `Statut: ${ascii(ctx.statutLabel)}`,
  ]
  if (ctx.type === 'facture') {
    docLines.push(`Paiement: ${ascii(statutPaiementLabel(vente.statutPaiement))}`)
    if (vente.dateEcheance) {
      docLines.push(`Echeance: ${formatDate(vente.dateEcheance)}`)
    }
  }
  for (const line of docLines) {
    doc.text(line, leftX, leftY, { width: colWidth })
    leftY += 12
  }

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text('Client', rightX, y)
  doc.font('Helvetica').fontSize(9).fillColor('#333333')
  let rightY = y + 14
  const clientLines = [
    ascii(client.nom),
    client.code ? `Code: ${client.code}` : null,
    client.telephone ? `Tel: ${client.telephone}` : null,
    client.adresse ? ascii(client.adresse) : null,
    client.ville ? ascii(client.ville) : null,
  ].filter(Boolean) as string[]

  for (const line of clientLines) {
    doc.text(line, rightX, rightY, { width: colWidth })
    rightY += 12
  }

  if (ctx.vendeur) {
    const vendeurNom =
      `${ctx.vendeur.prenom ?? ''} ${ctx.vendeur.nom ?? ''}`.trim() || ctx.vendeur.email
    doc.font('Helvetica').fontSize(8).fillColor('#666666')
    doc.text(`Vendeur: ${ascii(vendeurNom)}`, leftX, Math.max(leftY, rightY) + 6, {
      width: CONTENT_WIDTH,
    })
  }

  return Math.max(leftY, rightY) + 18
}

function drawFactureLines(doc: PdfDoc, ctx: VenteImpressionContext, startY: number) {
  const headers = ['Code', 'Designation', 'Qte', 'PU', 'Rem.%', 'TVA%', 'Montant TTC']
  const widths = [48, 168, 38, 62, 38, 38, 78]
  let y = startY

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff')
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 18).fill('#374151')
  let x = PAGE_MARGIN + 4
  for (let i = 0; i < headers.length; i++) {
    doc.fillColor('#ffffff').text(headers[i], x, y + 5, { width: widths[i] - 4 })
    x += widths[i]
  }
  y += 20

  doc.font('Helvetica').fontSize(8).fillColor('#111111')
  for (const ligne of ctx.lignes) {
    if (y > 740) {
      doc.addPage()
      y = PAGE_MARGIN
    }

    const rowHeight = 16
    if ((ctx.lignes.indexOf(ligne) % 2) === 1) {
      doc.rect(PAGE_MARGIN, y - 1, CONTENT_WIDTH, rowHeight).fill('#f8fafc')
      doc.fillColor('#111111')
    }

    const cells = [
      ligne.code ?? '-',
      ascii(ligne.designation),
      formatQty(ligne.quantite),
      formatMoney(ligne.prixUnitaire),
      `${ligne.remisePct}%`,
      `${ligne.tvaPct}%`,
      formatMoney(ligne.montantTtc),
    ]

    x = PAGE_MARGIN + 4
    for (let i = 0; i < cells.length; i++) {
      doc.text(cells[i], x, y + 2, { width: widths[i] - 4, ellipsis: true })
      x += widths[i]
    }
    y += rowHeight
  }

  return y + 10
}

function drawBonSortieLines(doc: PdfDoc, ctx: VenteImpressionContext, startY: number) {
  const headers = ['Code', 'Designation', 'Quantite']
  const widths = [70, CONTENT_WIDTH - 70 - 80, 80]
  let y = startY

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff')
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 18).fill('#374151')
  let x = PAGE_MARGIN + 4
  for (let i = 0; i < headers.length; i++) {
    doc.fillColor('#ffffff').text(headers[i], x, y + 5, { width: widths[i] - 4 })
    x += widths[i]
  }
  y += 20

  doc.font('Helvetica').fontSize(9).fillColor('#111111')
  for (const ligne of ctx.lignes) {
    if (y > 740) {
      doc.addPage()
      y = PAGE_MARGIN
    }

    const rowHeight = 18
    if ((ctx.lignes.indexOf(ligne) % 2) === 1) {
      doc.rect(PAGE_MARGIN, y - 1, CONTENT_WIDTH, rowHeight).fill('#f8fafc')
      doc.fillColor('#111111')
    }

    const cells = [ligne.code ?? '-', ascii(ligne.designation), formatQty(ligne.quantite)]
    x = PAGE_MARGIN + 4
    for (let i = 0; i < cells.length; i++) {
      doc.text(cells[i], x, y + 3, { width: widths[i] - 4, ellipsis: true })
      x += widths[i]
    }
    y += rowHeight
  }

  return y + 10
}

function drawTotals(doc: PdfDoc, ctx: VenteImpressionContext, y: number) {
  const vente = ctx.vente
  const boxWidth = 220
  const boxX = PAGE_MARGIN + CONTENT_WIDTH - boxWidth

  drawDivider(doc, y)
  y += 12

  const rows = [
    ['Sous-total', formatMoney(Number(vente.sousTotal))],
    ['Remise', formatMoney(Number(vente.remiseMontant))],
    ['TVA', formatMoney(Number(vente.tvaMontant))],
    ['Total TTC', formatMoney(Number(vente.totalTtc))],
    ['Montant paye', formatMoney(Number(vente.montantPaye))],
    ['Reste a payer', formatMoney(Number(vente.resteAPayer))],
  ]

  doc.font('Helvetica').fontSize(9).fillColor('#333333')
  for (const [label, value] of rows) {
    const isTotal = label === 'Total TTC'
    doc.font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(isTotal ? 10 : 9)
    doc.text(label, boxX, y, { width: 110, align: 'left' })
    doc.text(value, boxX + 110, y, { width: 110, align: 'right' })
    y += isTotal ? 16 : 13
  }

  return y + 8
}

function drawFooter(doc: PdfDoc, ctx: VenteImpressionContext) {
  const footerY = 800
  drawDivider(doc, footerY)
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#666666')
    .text(
      `Impression n°${ctx.impression.impression_numero} - Genere le ${ctx.generatedAt.toFormat('dd/MM/yyyy HH:mm')}`,
      PAGE_MARGIN,
      footerY + 8,
      { width: CONTENT_WIDTH, align: 'center' }
    )

  if (ctx.vente.notes) {
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#444444')
      .text(`Notes: ${ascii(ctx.vente.notes)}`, PAGE_MARGIN, footerY - 28, { width: CONTENT_WIDTH })
  }
}

function renderPdf(render: (doc: PdfDoc) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN })
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk as Buffer))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    render(doc)
    doc.end()
  })
}

export function generateVenteFacturePdf(ctx: VenteImpressionContext): Promise<Buffer> {
  return renderPdf((doc) => {
    let y = drawPointDeVenteHeader(doc, ctx, PAGE_MARGIN)
    y = drawDocumentTitle(doc, ctx, y)
    drawDivider(doc, y)
    y += 12
    y = drawMetaBlock(doc, ctx, y)
    y = drawFactureLines(doc, ctx, y)
    y = drawTotals(doc, ctx, y)
    drawFooter(doc, ctx)
  })
}

export function generateVenteBonSortiePdf(ctx: VenteImpressionContext): Promise<Buffer> {
  return renderPdf((doc) => {
    let y = drawPointDeVenteHeader(doc, ctx, PAGE_MARGIN)
    y = drawDocumentTitle(doc, ctx, y)
    drawDivider(doc, y)
    y += 12
    y = drawMetaBlock(doc, ctx, y)

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#333333')
      .text(`Facture liee: ${ctx.vente.numero}`, PAGE_MARGIN, y)
    y += 18

    y = drawBonSortieLines(doc, ctx, y)
    drawFooter(doc, ctx)
  })
}

export function pdfFilename(ctx: VenteImpressionContext): string {
  const slug = ctx.vente.numero.replace(/[^a-zA-Z0-9-]+/g, '_')
  return ctx.type === 'facture' ? `facture-${slug}.pdf` : `bon-sortie-${slug}.pdf`
}
