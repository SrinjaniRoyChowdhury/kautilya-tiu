import QRCode from "qrcode";

/** 16 CSPRNG bytes hex-encoded = 128 bits (NFR-SEC-007 asks for ≥ 96). Display codes are not this. */
export const OPAQUE_QR_TOKEN = /^[0-9a-f]{32}$/i;

export function isOpaqueQrToken(token: string): boolean {
  return OPAQUE_QR_TOKEN.test(token.trim());
}

export async function qrPngDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#3a2a12", light: "#fffdf7" },
  });
}

export function qrPngBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => vars[key] ?? "");
}
