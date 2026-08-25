import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPaymentInstructions } from "@/lib/data";
import { isUuid } from "@/lib/ids";
import { isStorageObjectKey } from "@/lib/safe-path";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ editionId: string }> },
) {
  const { editionId } = await context.params;
  if (!isUuid(editionId)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const instructions = await getPaymentInstructions(editionId);
  if (!instructions?.upi_qr_image_key || !isStorageObjectKey(instructions.upi_qr_image_key)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("cms-media").download(instructions.upi_qr_image_key);
  if (error || !data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  return new NextResponse(bytes, {
    headers: {
      "content-type": data.type || "image/png",
      "cache-control": "private, max-age=60",
      "content-disposition": "inline",
    },
  });
}
