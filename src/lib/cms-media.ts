import { createAdminClient } from "@/lib/supabase/admin";
import { compressSquareImage } from "@/lib/image-compress";
import { validateCommitteeLogoBytes } from "@/lib/upload";

function photoError(message: string): string {
  return message.replace(/^Logo:/, "Photo:");
}

export async function uploadCmsMediaImage(
  storageKey: string,
  buffer: Buffer,
): Promise<{ url: string | null; error?: string }> {
  const dimError = validateCommitteeLogoBytes(new Uint8Array(buffer));
  if (dimError) return { url: null, error: photoError(dimError) };

  const compressed = await compressSquareImage(buffer);
  if ("error" in compressed) return { url: null, error: photoError(compressed.error) };

  const key = storageKey.replace(/\.(jpg|jpeg|png|webp)$/i, `.${compressed.extension}`);
  const admin = createAdminClient();
  const upload = await admin.storage.from("cms-media").upload(key, compressed.buffer, {
    contentType: compressed.mime,
    upsert: true,
  });
  if (upload.error) return { url: null, error: "Photo: could not store the image." };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  return { url: `${base}/storage/v1/object/public/cms-media/${key}` };
}

export async function validateOptionalSquareImageFile(formData: FormData, fieldName: string): Promise<string | null> {
  const file = formData.get(fieldName);
  if (!(file instanceof File) || file.size === 0) return null;
  const buffer = Buffer.from(await file.arrayBuffer());
  const error = validateCommitteeLogoBytes(new Uint8Array(buffer));
  return error ? photoError(error) : null;
}

export async function resolveSquareImageUpload(
  formData: FormData,
  fileField: string,
  removeField: string,
  currentUrl: string | null,
  buildKey: (mime: "image/webp") => string,
): Promise<{ url: string | null; error?: string }> {
  if (formData.get(removeField) === "on") return { url: null };
  const file = formData.get(fileField);
  if (!(file instanceof File) || file.size === 0) return { url: currentUrl };
  const buffer = Buffer.from(await file.arrayBuffer());
  const dimError = validateCommitteeLogoBytes(new Uint8Array(buffer));
  if (dimError) return { url: null, error: photoError(dimError) };
  return uploadCmsMediaImage(buildKey("image/webp"), buffer);
}
