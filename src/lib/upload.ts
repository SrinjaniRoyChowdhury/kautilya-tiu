export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const COMMITTEE_LOGO_PX = 512;
export const COMMITTEE_CARD_BG_PX = 1080;

export type ProofMime = "image/jpeg" | "image/png" | "image/webp";

export type ImageDimensions = { width: number; height: number };

export function sniffPdf(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

export function sniffImageMime(bytes: Uint8Array): ProofMime | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}

export function proofExtension(mime: ProofMime): "jpg" | "png" | "webp" {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xd8) {
      i += 2;
      continue;
    }
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
      };
    }
    const size = ((bytes[i + 2] << 8) | bytes[i + 3]) + 2;
    if (size < 2) return null;
    i += size;
  }
  return null;
}

function readWebpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 30) return null;
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff !== "RIFF" || webp !== "WEBP") return null;
  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunk === "VP8X" && bytes.length >= 30) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {
      width: 1 + view.getUint32(24, true),
      height: 1 + view.getUint32(27, true),
    };
  }
  if (chunk === "VP8 " && bytes.length >= 30) {
    return {
      width: bytes[26] | (bytes[27] << 8),
      height: bytes[28] | (bytes[29] << 8),
    };
  }
  if (chunk === "VP8L" && bytes.length >= 25) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >> 14) & 0x3fff),
    };
  }
  return null;
}

export function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  const mime = sniffImageMime(bytes);
  if (mime === "image/png") return readPngDimensions(bytes);
  if (mime === "image/jpeg") return readJpegDimensions(bytes);
  if (mime === "image/webp") return readWebpDimensions(bytes);
  return null;
}

export function validateCommitteeLogoBytes(bytes: Uint8Array): string | null {
  return validateSquareImageBytes(bytes, COMMITTEE_LOGO_PX, "Logo");
}

export function validateCommitteeCardBackgroundBytes(bytes: Uint8Array): string | null {
  return validateSquareImageBytes(bytes, COMMITTEE_CARD_BG_PX, "Card background");
}

function validateSquareImageBytes(bytes: Uint8Array, px: number, label: string): string | null {
  const mime = sniffImageMime(bytes);
  if (!mime) return `${label}: use JPEG, PNG, or WebP.`;
  if (bytes.length > MAX_PROOF_BYTES) {
    return `${label}: file must be ${Math.round(MAX_PROOF_BYTES / (1024 * 1024))} MB or smaller.`;
  }
  const dims = readImageDimensions(bytes);
  if (!dims) return `${label}: could not read image dimensions.`;
  if (dims.width !== dims.height) {
    return `${label}: image must be square (1:1). Yours is ${dims.width}×${dims.height} px.`;
  }
  if (dims.width !== px || dims.height !== px) {
    return `${label}: use ${px}×${px} px. Yours is ${dims.width}×${dims.height} px.`;
  }
  return null;
}
