import { NextResponse } from "next/server";
import { getSessionUser, hasPermission } from "@/lib/auth";
import { getPaymentById } from "@/lib/data";
import { isUuid } from "@/lib/ids";
import { isStorageObjectKey } from "@/lib/safe-path";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const payment = await getPaymentById(id);
  if (!payment?.proof_image_key || !isStorageObjectKey(payment.proof_image_key)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const isPayer = payment.payer_user_id === user.id;
  const canView = isPayer || (await hasPermission("payment.view", payment.edition_id));
  if (!canView) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("payment-proofs").download(payment.proof_image_key);
  if (error || !data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  return new NextResponse(bytes, {
    headers: {
      "content-type": data.type || "image/jpeg",
      "cache-control": "private, max-age=60",
      "content-disposition": "inline",
    },
  });
}
