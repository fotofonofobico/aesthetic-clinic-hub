import QRCode from "qrcode";

/**
 * Genera un QR code come data URL (PNG base64) da inserire nei PDF firmati.
 * Il testo tipico è l'URL di verifica del documento (share/consenso/{hash}).
 */
export async function generaQrCodeDataUrl(testo: string): Promise<string> {
  return QRCode.toDataURL(testo, {
    width: 80,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
