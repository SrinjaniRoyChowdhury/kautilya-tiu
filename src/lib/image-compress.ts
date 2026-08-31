import sharp from "sharp";
import {
  COMMITTEE_LOGO_PX,
  MAX_PROOF_BYTES,
  proofExtension,
  sniffImageMime,
  type ProofMime,
} from "@/lib/upload";

export type CompressedImage = {
  buffer: Buffer;
  mime: ProofMime;
  extension: "jpg" | "png" | "webp";
};

const PROOF_MAX_EDGE = 1600;
const PROOF_WEBP_QUALITY = 82;
const SQUARE_WEBP_QUALITY = 85;

/**
 * Re-encode uploads as WebP (or keep JPEG if WebP fails) at high quality.
 * Display size stays the same for square assets; proofs are capped at PROOF_MAX_EDGE.
 */
export async function compressSquareImage(input: Buffer): Promise<CompressedImage | { error: string }> {
  if (input.length > MAX_PROOF_BYTES) {
    return { error: `File must be ${Math.round(MAX_PROOF_BYTES / (1024 * 1024))} MB or smaller.` };
  }
  const mime = sniffImageMime(input);
  if (!mime) return { error: "Use JPEG, PNG, or WebP." };

  try {
    const pipeline = sharp(input, { failOn: "none" })
      .rotate()
      .resize(COMMITTEE_LOGO_PX, COMMITTEE_LOGO_PX, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: SQUARE_WEBP_QUALITY, effort: 4 });

    const buffer = Buffer.from(await pipeline.toBuffer());
    return { buffer, mime: "image/webp", extension: "webp" };
  } catch {
    return { error: "Could not process the image." };
  }
}

export async function compressProofImage(input: Buffer): Promise<CompressedImage | { error: string }> {
  if (input.length > MAX_PROOF_BYTES) {
    return { error: `Screenshot must be ${Math.round(MAX_PROOF_BYTES / (1024 * 1024))} MB or smaller.` };
  }
  const mime = sniffImageMime(input);
  if (!mime) return { error: "Use JPEG, PNG, or WebP." };

  try {
    const image = sharp(input, { failOn: "none" }).rotate();
    const meta = await image.metadata();
    const width = meta.width ?? PROOF_MAX_EDGE;
    const height = meta.height ?? PROOF_MAX_EDGE;
    const longest = Math.max(width, height);
    const resized =
      longest > PROOF_MAX_EDGE
        ? image.resize({
            width: width >= height ? PROOF_MAX_EDGE : undefined,
            height: height > width ? PROOF_MAX_EDGE : undefined,
            fit: "inside",
            withoutEnlargement: true,
          })
        : image;

    const buffer = Buffer.from(await resized.webp({ quality: PROOF_WEBP_QUALITY, effort: 4 }).toBuffer());
    return { buffer, mime: "image/webp", extension: "webp" };
  } catch {
    // Fall back to original bytes if sharp cannot encode.
    return {
      buffer: input,
      mime,
      extension: proofExtension(mime),
    };
  }
}
