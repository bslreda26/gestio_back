import QRCode from 'qrcode'

export async function generateQrCodePng(content: string, size = 180): Promise<Buffer> {
  return QRCode.toBuffer(content, {
    type: 'png',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  })
}
