import type { VenteImpressionContext } from '#services/vente_impression_service'
import { statutPaiementLabel } from '#services/vente_impression_service'
import { venteTotalAPayer } from '#helpers/timbre'
import { VENTE_STATUT, isFactureRetour } from '#constants/vente_statuts'
import PDFDocument from 'pdfkit'

const PAGE_MARGIN = 48
const PAGE_WIDTH = 595.28
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2

const C = {
  black: '#000000',
  white: '#ffffff',
  ink: '#111111',
  text: '#333333',
  muted: '#666666',
  light: '#999999',
  border: '#cccccc',
  fill: '#f5f5f5',
} as const

function formatMoney(value: number): string {
  const formatted = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)
  // PDFKit Helvetica cannot render fr-FR narrow no-break space (U+202F) — it appears as "/"
  const safe = formatted.replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ')
  return `${safe} FCFA`
}

function formatQty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '')
}

function formatDate(value: { toFormat: (fmt: string) => string } | null | undefined): string {
  if (!value) return '—'
  return value.toFormat('dd/MM/yyyy')
}

function formatDateTime(value: { toFormat: (fmt: string) => string } | null | undefined): string {
  if (!value) return '—'
  return value.toFormat('dd/MM/yyyy HH:mm')
}

function ascii(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?')
}

type PdfDoc = InstanceType<typeof PDFDocument>

function drawLine(doc: PdfDoc, y: number, weight = 0.5, color = C.border) {
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y)
    .lineWidth(weight)
    .strokeColor(color)
    .stroke()
}


function impressionBadgeText(label: string): string {
  return label === 'DUPLICATA' ? 'DUPLICATA' : 'ORIGINAL'
}

function statusBannerText(statut: string): string | null {
  if (statut === VENTE_STATUT.NON_VALIDE) return 'FACTURE NON VALIDEE'
  if (statut === VENTE_STATUT.DEVIS) return 'DEVIS — DOCUMENT NON VALIDE'
  return null
}

function drawStatusBanner(doc: PdfDoc, ctx: VenteImpressionContext, startY: number): number {
  const text = statusBannerText(ctx.vente.statut)
  if (!text) return startY

  const bannerH = 30
  doc.rect(PAGE_MARGIN, startY, CONTENT_WIDTH, bannerH).fill(C.black)
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(C.white)
    .text(ascii(text), PAGE_MARGIN, startY + 9, {
      width: CONTENT_WIDTH,
      align: 'center',
      characterSpacing: 1.2,
    })

  return startY + bannerH + 14
}

function drawBlackDocumentHeader(doc: PdfDoc, ctx: VenteImpressionContext, startY: number): number {
  const showQr = ctx.type === 'facture' && ctx.vente.normalise && ctx.qrCodePng
  const qrSize = showQr ? 52 : 0
  const pad = 10
  const headerH = Math.max(50, qrSize + pad * 2)

  doc.rect(PAGE_MARGIN, startY, CONTENT_WIDTH, headerH).fill(C.black)

  const leftW = CONTENT_WIDTH * 0.36
  const centerW = CONTENT_WIDTH * 0.34
  const leftX = PAGE_MARGIN + pad
  const centerX = PAGE_MARGIN + leftW

  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.white)
  doc.text(ascii(ctx.pointDeVente.nom), leftX, startY + pad, { width: leftW - pad })

  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white)
  doc.text(ctx.documentTitle, leftX, startY + pad + 14, {
    width: leftW - pad,
    characterSpacing: 0.8,
  })

  const badgeText = impressionBadgeText(ctx.impression.label)
  const badgeW = badgeText === 'DUPLICATA' ? 90 : 76
  const badgeH = 20
  const badgeX = centerX + (centerW - badgeW) / 2
  const badgeY = startY + (headerH - badgeH) / 2

  doc
    .rect(badgeX, badgeY, badgeW, badgeH)
    .lineWidth(1)
    .strokeColor(C.white)
    .stroke()

  doc
    .font('Helvetica-Bold')
    .fontSize(badgeText === 'DUPLICATA' ? 8 : 7)
    .fillColor(C.white)
    .text(badgeText, badgeX, badgeY + (badgeText === 'DUPLICATA' ? 6 : 7), {
      width: badgeW,
      align: 'center',
      characterSpacing: 0.8,
    })

  if (showQr && ctx.qrCodePng) {
    const qrX = PAGE_MARGIN + CONTENT_WIDTH - qrSize - pad
    const qrY = startY + (headerH - qrSize) / 2
    doc.image(ctx.qrCodePng, qrX, qrY, { width: qrSize, height: qrSize })
  }

  return startY + headerH + 6
}

function drawPosContactLine(doc: PdfDoc, ctx: VenteImpressionContext, startY: number): number {
  const pos = ctx.pointDeVente
  const parts: string[] = []
  if (pos.adresse) parts.push(ascii(pos.adresse))
  const villeTel = [pos.ville?.toUpperCase(), pos.telephone ? `Tel. ${pos.telephone}` : null]
    .filter(Boolean)
    .join('  ·  ')
  if (villeTel) parts.push(villeTel)

  if (parts.length === 0) return startY

  doc.font('Helvetica').fontSize(7).fillColor(C.muted)
  doc.text(parts.join('  ·  '), PAGE_MARGIN, startY, { width: CONTENT_WIDTH })

  return startY + 11
}

type MetaField = { label: string; value: string }

function drawMetaField(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  field: MetaField
): number {
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(C.muted).text(field.label.toUpperCase(), x, y, { width })
  doc.font('Helvetica').fontSize(7.5).fillColor(C.text).text(field.value, x, y + 8, { width })
  return y + 18
}

function drawMetaColumn(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  fields: MetaField[]
): number {
  let rowY = y
  for (const field of fields) {
    rowY = drawMetaField(doc, x, rowY, width, field)
  }
  return rowY
}

function drawMetaBlock(doc: PdfDoc, ctx: VenteImpressionContext, y: number) {
  const vente = ctx.vente
  const client = ctx.client
  const gap = 20
  const colWidth = (CONTENT_WIDTH - gap) / 2
  const leftX = PAGE_MARGIN
  const rightX = PAGE_MARGIN + colWidth + gap

  const clientFields: MetaField[] = [
    { label: 'Client', value: ascii(client.nom) },
  ]
  if (client.code) clientFields.push({ label: 'Code', value: client.code })
  if (client.telephone) clientFields.push({ label: 'Tel.', value: client.telephone })

  const docFields: MetaField[] = [
    { label: 'Numero', value: vente.numero },
    { label: 'Date', value: formatDate(vente.dateVente) },
    { label: 'Statut', value: ascii(ctx.statutLabel) },
  ]

  if (ctx.type === 'facture') {
    docFields.push({ label: 'Paiement', value: ascii(statutPaiementLabel(vente.statutPaiement)) })
    if (vente.dateEcheance) {
      docFields.push({ label: 'Echeance', value: formatDate(vente.dateEcheance) })
    }
  }

  if (ctx.type === 'bon_sortie') {
    docFields.push({ label: 'Facture liee', value: vente.numero })
  }

  if (isFactureRetour(vente.statut) && vente.factureOrigineId) {
    docFields.push({
      label: 'Facture orig.',
      value: ctx.factureOrigineNumero ?? String(vente.factureOrigineId),
    })
  }

  if (ctx.vendeur) {
    const vendeurNom =
      `${ctx.vendeur.prenom ?? ''} ${ctx.vendeur.nom ?? ''}`.trim() || ctx.vendeur.email
    docFields.push({ label: 'Vendeur', value: ascii(vendeurNom) })
  }

  if (ctx.vente.normalise && ctx.fne) {
    if (ctx.fne.reference) docFields.push({ label: 'Ref. FNE', value: ascii(ctx.fne.reference) })
    if (ctx.vente.certifiedAt) {
      docFields.push({ label: 'Certifiee le', value: formatDateTime(ctx.vente.certifiedAt) })
    }
  }

  const leftEnd = drawMetaColumn(doc, leftX, y, colWidth, clientFields)
  const rightEnd = drawMetaColumn(doc, rightX, y, colWidth, docFields)
  const blockEnd = Math.max(leftEnd, rightEnd)

  drawLine(doc, blockEnd + 4)
  return blockEnd + 12
}

type TableColumn = {
  header: string
  width: number
  align?: 'left' | 'right' | 'center'
}

function drawTable(
  doc: PdfDoc,
  columns: TableColumn[],
  rows: string[][],
  startY: number,
  options?: { rowHeight?: number; fontSize?: number }
): number {
  const rowHeight = options?.rowHeight ?? 17
  const fontSize = options?.fontSize ?? 8
  const headerH = 20
  let y = startY

  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, headerH).fill(C.black)

  let x = PAGE_MARGIN + 6
  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(C.white)
  for (const col of columns) {
    doc.text(col.header, x, y + 6, {
      width: col.width - 8,
      align: col.align ?? 'left',
    })
    x += col.width
  }
  y += headerH

  doc.font('Helvetica').fontSize(fontSize).fillColor(C.text)
  for (let i = 0; i < rows.length; i++) {
    if (y > 720) {
      doc.addPage()
      y = PAGE_MARGIN
    }

    if (i % 2 === 1) {
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, rowHeight).fill(C.fill)
      doc.fillColor(C.text)
    }

    x = PAGE_MARGIN + 6
    const cells = rows[i]
    for (let c = 0; c < columns.length; c++) {
      doc.text(cells[c] ?? '', x, y + 4, {
        width: columns[c].width - 8,
        align: columns[c].align ?? 'left',
        ellipsis: true,
      })
      x += columns[c].width
    }
    y += rowHeight
  }

  doc.rect(PAGE_MARGIN, startY, CONTENT_WIDTH, y - startY).lineWidth(0.75).strokeColor(C.black).stroke()

  return y + 14
}

function formatLigneTaxes(ligne: VenteImpressionContext['lignes'][number]): string {
  const parts = [`TVA ${ligne.tvaPct}%`]
  if (ligne.airsiPct > 0) {
    parts.push(`AIRSI ${ligne.airsiPct}%`)
  }
  return parts.join(', ')
}

function drawFactureLines(doc: PdfDoc, ctx: VenteImpressionContext, startY: number) {
  const showLigneRemise = ctx.includeLigneRemisePct
  const columns: TableColumn[] = [
    { header: 'Code', width: 44 },
    { header: 'Designation', width: showLigneRemise ? 155 : 189 },
    { header: 'Qte', width: 34, align: 'right' },
    { header: 'P.U.', width: 56, align: 'right' },
    ...(showLigneRemise ? [{ header: 'Rem.%', width: 34, align: 'right' as const }] : []),
    { header: 'Taxes', width: 72, align: 'right' },
    { header: 'Montant TTC', width: 78, align: 'right' },
  ]

  const rows = ctx.lignes.map((ligne) => {
    const cells: string[] = [
      ligne.code ?? '—',
      ascii(ligne.designation),
      formatQty(ligne.quantite),
      formatMoney(ligne.prixUnitaire),
    ]
    if (showLigneRemise) cells.push(`${ligne.remisePct}%`)
    cells.push(ascii(formatLigneTaxes(ligne)))
    cells.push(formatMoney(ligne.airsiMontant > 0 ? ligne.montantApresAirsi : ligne.montantTtc))
    return cells
  })

  return drawTable(doc, columns, rows, startY)
}

function drawBonSortieLines(doc: PdfDoc, ctx: VenteImpressionContext, startY: number) {
  const qtyWidth = 72
  const codeWidth = 72
  const columns: TableColumn[] = [
    { header: 'Code', width: codeWidth },
    { header: 'Designation', width: CONTENT_WIDTH - codeWidth - qtyWidth },
    { header: 'Quantite', width: qtyWidth, align: 'right' },
  ]

  const rows = ctx.lignes.map((ligne) => [
    ligne.code ?? '—',
    ascii(ligne.designation),
    formatQty(ligne.quantite),
  ])

  return drawTable(doc, columns, rows, startY, { rowHeight: 18, fontSize: 9 })
}

function formatPct(value: number): string {
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)} %`
}

function drawTotals(doc: PdfDoc, ctx: VenteImpressionContext, y: number) {
  const vente = ctx.vente
  const boxWidth = 240
  const boxX = PAGE_MARGIN + CONTENT_WIDTH - boxWidth
  const padding = 12

  const airsiPct = Number(vente.airsiPct)
  const airsiMontant = Number(vente.airsiMontant)
  const remiseMontant = Number(vente.remiseMontant)
  const totalTtc = Number(vente.totalTtc)
  const montantTimbre = Number(vente.montantTimbre ?? 0)
  const finalTtc = venteTotalAPayer({
    totalApresAirsi: airsiMontant > 0 ? Number(vente.totalApresAirsi) : totalTtc,
    montantTimbre,
  })

  const rows: [string, string, boolean][] = []

  if (ctx.includeRemiseMontant && remiseMontant > 0) {
    rows.push(['Sous-total HT', formatMoney(Number(vente.totalHt) + remiseMontant), false])
    rows.push(['Remise', `- ${formatMoney(remiseMontant)}`, false])
  }

  rows.push(['Total HT', formatMoney(Number(vente.totalHt)), false], ['TVA', formatMoney(Number(vente.tvaMontant)), false])

  if (ctx.type === 'facture') {
    if (airsiMontant > 0) {
      rows.push(['Total TTC', formatMoney(totalTtc), false])
      rows.push([`AIRSI (${formatPct(airsiPct)})`, formatMoney(airsiMontant), false])
    } else if (montantTimbre > 0) {
      rows.push(['Total TTC', formatMoney(totalTtc), false])
    }
    if (montantTimbre > 0) {
      rows.push(['Timbre fiscal', formatMoney(montantTimbre), false])
    }
    if (airsiMontant > 0 || montantTimbre > 0) {
      rows.push(['Total a payer', formatMoney(finalTtc), true])
    } else {
      rows.push(['Total TTC', formatMoney(totalTtc), true])
    }
  } else {
    rows[rows.length - 1] = [rows[rows.length - 1][0], rows[rows.length - 1][1], true]
  }

  const rowH = 15
  const totalRowH = 22
  const normalCount = rows.filter(([, , isTotal]) => !isTotal).length
  const boxH = padding * 2 + normalCount * rowH + totalRowH + 8

  doc.rect(boxX, y, boxWidth, boxH).lineWidth(0.75).strokeColor(C.black).stroke()

  let rowY = y + padding
  for (const [label, value, isTotal] of rows) {
    if (isTotal) {
      drawLine(doc, rowY - 4, 0.5, C.border)
      doc.rect(boxX + 1, rowY, boxWidth - 2, totalRowH).fill(C.black)
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.white)
      doc.text(label, boxX + padding, rowY + 6, { width: 110 })
      doc.text(value, boxX + padding, rowY + 6, { width: boxWidth - padding * 2, align: 'right' })
      rowY += totalRowH + 4
      doc.fillColor(C.text)
      continue
    }

    doc.font('Helvetica').fontSize(9).fillColor(C.muted)
    doc.text(label, boxX + padding, rowY, { width: 110 })
    doc.font('Helvetica').fontSize(9).fillColor(C.text)
    doc.text(value, boxX + padding, rowY, { width: boxWidth - padding * 2, align: 'right' })
    rowY += rowH
  }

  return y + boxH + 16
}

function drawFneVerificationNote(doc: PdfDoc, ctx: VenteImpressionContext, y: number): number {
  if (!ctx.vente.normalise || ctx.type !== 'facture' || !ctx.fne) return y

  const title = isFactureRetour(ctx.vente.statut) ? 'Avoir certifie FNE' : 'Facture certifiee FNE'
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.muted).text(title, PAGE_MARGIN, y, { width: CONTENT_WIDTH })

  let textY = y + 10
  doc.font('Helvetica').fontSize(6.5).fillColor(C.light)
  if (ctx.fne.token) {
    doc.text(`Verification : ${ascii(ctx.fne.token)}`, PAGE_MARGIN, textY, {
      width: CONTENT_WIDTH,
      lineBreak: true,
    })
    textY += 14
  } else {
    doc.text('Scannez le QR code en entete pour verifier aupres de la DGI.', PAGE_MARGIN, textY, {
      width: CONTENT_WIDTH,
    })
    textY += 10
  }

  return textY + 6
}

function drawFooter(doc: PdfDoc, ctx: VenteImpressionContext, contentBottomY: number) {
  const footerY = Math.max(contentBottomY + 24, 760)

  if (ctx.vente.notes) {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(C.text)
      .text('Notes', PAGE_MARGIN, footerY - 36)
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(C.muted)
      .text(ascii(ctx.vente.notes), PAGE_MARGIN, footerY - 24, { width: CONTENT_WIDTH })
  }

  drawLine(doc, footerY)
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(C.light)
    .text(
      `Impression n°${ctx.impression.impression_numero}  ·  Genere le ${ctx.generatedAt.toFormat('dd/MM/yyyy a HH:mm')}`,
      PAGE_MARGIN,
      footerY + 8,
      { width: CONTENT_WIDTH, align: 'center' }
    )
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
    let y = drawStatusBanner(doc, ctx, PAGE_MARGIN)
    y = drawBlackDocumentHeader(doc, ctx, y)
    y = drawPosContactLine(doc, ctx, y)
    y = drawMetaBlock(doc, ctx, y)
    y = drawFactureLines(doc, ctx, y)
    y = drawTotals(doc, ctx, y)
    y = drawFneVerificationNote(doc, ctx, y)
    drawFooter(doc, ctx, y)
  })
}

export function generateVenteBonSortiePdf(ctx: VenteImpressionContext): Promise<Buffer> {
  return renderPdf((doc) => {
    let y = drawStatusBanner(doc, ctx, PAGE_MARGIN)
    y = drawBlackDocumentHeader(doc, ctx, y)
    y = drawPosContactLine(doc, ctx, y)
    y = drawMetaBlock(doc, ctx, y)
    y = drawBonSortieLines(doc, ctx, y)
    drawFooter(doc, ctx, y)
  })
}

export function pdfFilename(ctx: VenteImpressionContext): string {
  const slug = ctx.vente.numero.replace(/[^a-zA-Z0-9-]+/g, '_')
  return ctx.type === 'facture' ? `facture-${slug}.pdf` : `bon-sortie-${slug}.pdf`
}
