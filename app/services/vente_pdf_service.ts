import type { VenteImpressionContext } from '#services/vente_impression_service'
import { statutPaiementLabel } from '#services/vente_impression_service'
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

function drawThickLine(doc: PdfDoc, y: number) {
  drawLine(doc, y, 1.5, C.black)
}

function drawBadge(doc: PdfDoc, label: string, x: number, y: number) {
  const isDuplicata = label === 'DUPLICATA'
  const text = isDuplicata ? 'DUPLICATA' : 'ORIGINAL'
  const width = isDuplicata ? 88 : 72
  const height = 22

  doc
    .rect(x, y, width, height)
    .lineWidth(isDuplicata ? 1.5 : 0.75)
    .strokeColor(C.black)
    .stroke()

  doc
    .font('Helvetica-Bold')
    .fontSize(isDuplicata ? 8 : 7)
    .fillColor(C.black)
    .text(text, x, y + (isDuplicata ? 6 : 7), { width, align: 'center' })
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

function fneCertifiedBannerLabel(statut: string): string {
  if (isFactureRetour(statut)) return 'AVOIR CERTIFIE FNE'
  return 'FACTURE CERTIFIEE FNE'
}

function drawFneCertifiedBanner(doc: PdfDoc, ctx: VenteImpressionContext, startY: number): number {
  if (!ctx.vente.normalise || ctx.type !== 'facture') return startY

  const bannerH = 26
  doc.rect(PAGE_MARGIN, startY, CONTENT_WIDTH, bannerH).lineWidth(1).strokeColor(C.black).stroke()
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(C.black)
    .text(fneCertifiedBannerLabel(ctx.vente.statut), PAGE_MARGIN, startY + 8, {
      width: CONTENT_WIDTH,
      align: 'center',
      characterSpacing: 1,
    })

  return startY + bannerH + 12
}

function drawPointDeVenteHeader(doc: PdfDoc, ctx: VenteImpressionContext, startY: number) {
  const pos = ctx.pointDeVente
  const badgeX = PAGE_MARGIN + CONTENT_WIDTH - 88

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(C.black)
    .text(ascii(pos.nom), PAGE_MARGIN, startY, { width: CONTENT_WIDTH - 100 })

  drawBadge(doc, ctx.impression.label, badgeX, startY)

  let y = startY + 30
  doc.font('Helvetica').fontSize(9).fillColor(C.muted)

  const contactLines: string[] = []
  if (pos.adresse) contactLines.push(ascii(pos.adresse))
  const villeTel = [pos.ville?.toUpperCase(), pos.telephone ? `Tel. ${pos.telephone}` : null]
    .filter(Boolean)
    .join('  ·  ')
  if (villeTel) contactLines.push(villeTel)

  for (const line of contactLines) {
    doc.text(line, PAGE_MARGIN, y, { width: CONTENT_WIDTH - 100 })
    y += 13
  }

  return y + 10
}

function drawDocumentTitle(doc: PdfDoc, ctx: VenteImpressionContext, y: number) {
  drawThickLine(doc, y)
  y += 14

  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor(C.black)
    .text(ctx.documentTitle, PAGE_MARGIN, y, { align: 'center', width: CONTENT_WIDTH, characterSpacing: 1.5 })

  y += 28
  drawLine(doc, y)
  return y + 16
}

type MetaRow = { label: string; value: string }

function drawMetaCard(
  doc: PdfDoc,
  title: string,
  rows: MetaRow[],
  x: number,
  y: number,
  width: number
): number {
  const padding = 10
  const titleH = 16
  const rowH = 13
  const cardH = padding * 2 + titleH + rows.length * rowH

  doc.rect(x, y, width, cardH).lineWidth(0.75).strokeColor(C.black).stroke()

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(C.black)
    .text(title.toUpperCase(), x + padding, y + padding, { characterSpacing: 0.8 })

  let rowY = y + padding + titleH
  for (const row of rows) {
    doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(row.label, x + padding, rowY, { width: 62 })
    doc.font('Helvetica').fontSize(8).fillColor(C.text).text(row.value, x + padding + 64, rowY, {
      width: width - padding * 2 - 64,
    })
    rowY += rowH
  }

  return cardH
}

function drawMetaBlock(doc: PdfDoc, ctx: VenteImpressionContext, y: number) {
  const vente = ctx.vente
  const client = ctx.client
  const gap = 12
  const colWidth = (CONTENT_WIDTH - gap) / 2
  const leftX = PAGE_MARGIN
  const rightX = PAGE_MARGIN + colWidth + gap

  const docRows: MetaRow[] = [
    { label: 'Numero', value: vente.numero },
    { label: 'Date', value: formatDate(vente.dateVente) },
    { label: 'Statut', value: ascii(ctx.statutLabel) },
  ]

  if (ctx.type === 'facture') {
    docRows.push({ label: 'Paiement', value: ascii(statutPaiementLabel(vente.statutPaiement)) })
    if (vente.dateEcheance) {
      docRows.push({ label: 'Echeance', value: formatDate(vente.dateEcheance) })
    }
  }

  if (ctx.type === 'bon_sortie') {
    docRows.push({ label: 'Facture liee', value: vente.numero })
  }

  if (isFactureRetour(vente.statut) && vente.factureOrigineId) {
    docRows.push({
      label: 'Facture orig.',
      value: ctx.factureOrigineNumero ?? String(vente.factureOrigineId),
    })
  }

  if (ctx.vendeur) {
    const vendeurNom =
      `${ctx.vendeur.prenom ?? ''} ${ctx.vendeur.nom ?? ''}`.trim() || ctx.vendeur.email
    docRows.push({ label: 'Vendeur', value: ascii(vendeurNom) })
  }

  if (ctx.vente.normalise && ctx.fne) {
    if (ctx.fne.reference) docRows.push({ label: 'Ref. FNE', value: ascii(ctx.fne.reference) })
    if (ctx.fne.invoiceId) docRows.push({ label: 'ID FNE', value: ascii(ctx.fne.invoiceId) })
    if (ctx.vente.certifiedAt) {
      docRows.push({ label: 'Certifiee', value: formatDate(ctx.vente.certifiedAt) })
    }
  }

  const clientRows: MetaRow[] = [{ label: 'Nom', value: ascii(client.nom) }]
  if (client.code) clientRows.push({ label: 'Code', value: client.code })
  if (client.telephone) clientRows.push({ label: 'Tel.', value: client.telephone })
  if (client.adresse) clientRows.push({ label: 'Adresse', value: ascii(client.adresse) })
  if (client.ville) clientRows.push({ label: 'Ville', value: ascii(client.ville) })

  const leftH = drawMetaCard(doc, 'Document', docRows, leftX, y, colWidth)
  const rightH = drawMetaCard(doc, 'Client', clientRows, rightX, y, colWidth)

  return y + Math.max(leftH, rightH) + 20
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

function drawFactureLines(doc: PdfDoc, ctx: VenteImpressionContext, startY: number) {
  const columns: TableColumn[] = [
    { header: 'Code', width: 48 },
    { header: 'Designation', width: 197 },
    { header: 'Qte', width: 38, align: 'right' },
    { header: 'P.U.', width: 62, align: 'right' },
    { header: 'Rem.%', width: 38, align: 'right' },
    { header: 'TVA%', width: 38, align: 'right' },
    { header: 'Montant TTC', width: 78, align: 'right' },
  ]

  const rows = ctx.lignes.map((ligne) => [
    ligne.code ?? '—',
    ascii(ligne.designation),
    formatQty(ligne.quantite),
    formatMoney(ligne.prixUnitaire),
    `${ligne.remisePct}%`,
    `${ligne.tvaPct}%`,
    formatMoney(ligne.montantTtc),
  ])

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
  const finalTtc = airsiMontant > 0 ? Number(vente.totalApresAirsi) : totalTtc

  const rows: [string, string, boolean][] = [
    ['Total HT', formatMoney(Number(vente.totalHt)), false],
    ['TVA', formatMoney(Number(vente.tvaMontant)), false],
  ]

  if (ctx.type === 'facture') {
    if (airsiMontant > 0) {
      rows.push([`AIRSI (${formatPct(airsiPct)})`, `- ${formatMoney(airsiMontant)}`, false])
    }
    if (remiseMontant > 0) {
      rows.push(['Remise', `- ${formatMoney(remiseMontant)}`, false])
    }
    rows.push(['Total TTC', formatMoney(finalTtc), true])
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

function drawFneCertificationBlock(doc: PdfDoc, ctx: VenteImpressionContext, y: number): number {
  if (!ctx.vente.normalise || ctx.type !== 'facture') return y

  if (y > 620) {
    doc.addPage()
    y = PAGE_MARGIN
  }

  const blockH = 118
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, blockH).lineWidth(0.75).strokeColor(C.black).stroke()

  const qrSize = 88
  const textX = PAGE_MARGIN + qrSize + 24
  const textWidth = CONTENT_WIDTH - qrSize - 36

  if (ctx.qrCodePng) {
    doc.image(ctx.qrCodePng, PAGE_MARGIN + 12, y + 14, { width: qrSize, height: qrSize })
  } else {
    doc
      .rect(PAGE_MARGIN + 12, y + 14, qrSize, qrSize)
      .lineWidth(0.5)
      .strokeColor(C.border)
      .stroke()
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(C.muted)
      .text('QR indisponible', PAGE_MARGIN + 12, y + 52, { width: qrSize, align: 'center' })
  }

  let textY = y + 16
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.black).text(
    isFactureRetour(ctx.vente.statut) ? 'Verification avoir FNE' : 'Verification FNE',
    textX,
    textY,
    { width: textWidth }
  )
  textY += 16

  doc.font('Helvetica').fontSize(8).fillColor(C.text)
  if (ctx.fne?.reference) {
    doc.text(`Reference : ${ascii(ctx.fne.reference)}`, textX, textY, { width: textWidth })
    textY += 12
  }
  if (ctx.fne?.invoiceId) {
    doc.text(`ID facture : ${ascii(ctx.fne.invoiceId)}`, textX, textY, { width: textWidth })
    textY += 12
  }
  if (ctx.fne?.token) {
    doc.text(`URL : ${ascii(ctx.fne.token)}`, textX, textY, { width: textWidth, lineBreak: true })
    textY += 24
  }

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(C.muted)
    .text('Scannez le QR code pour verifier cette facture aupres de la DGI.', textX, y + blockH - 18, {
      width: textWidth,
    })

  return y + blockH + 16
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
    y = drawFneCertifiedBanner(doc, ctx, y)
    y = drawPointDeVenteHeader(doc, ctx, y)
    y = drawDocumentTitle(doc, ctx, y)
    y = drawMetaBlock(doc, ctx, y)
    y = drawFactureLines(doc, ctx, y)
    y = drawTotals(doc, ctx, y)
    y = drawFneCertificationBlock(doc, ctx, y)
    drawFooter(doc, ctx, y)
  })
}

export function generateVenteBonSortiePdf(ctx: VenteImpressionContext): Promise<Buffer> {
  return renderPdf((doc) => {
    let y = drawStatusBanner(doc, ctx, PAGE_MARGIN)
    y = drawPointDeVenteHeader(doc, ctx, y)
    y = drawDocumentTitle(doc, ctx, y)
    y = drawMetaBlock(doc, ctx, y)
    y = drawBonSortieLines(doc, ctx, y)
    drawFooter(doc, ctx, y)
  })
}

export function pdfFilename(ctx: VenteImpressionContext): string {
  const slug = ctx.vente.numero.replace(/[^a-zA-Z0-9-]+/g, '_')
  return ctx.type === 'facture' ? `facture-${slug}.pdf` : `bon-sortie-${slug}.pdf`
}
