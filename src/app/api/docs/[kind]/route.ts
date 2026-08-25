import { NextResponse } from "next/server";
import { isDocKind } from "@/lib/docs";
import { isStorageObjectKey } from "@/lib/safe-path";
import { createAdminClient } from "@/lib/supabase/admin";

function safeFilename(name: string, fallback: string) {
  const cleaned = name.replace(/[^\w.\- ()]/g, "").trim();
  return cleaned || fallback;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ kind: string }> },
) {
  const { kind } = await context.params;
  if (!isDocKind(kind)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("conference_documents")
    .select("storage_key, file_name")
    .eq("kind", kind)
    .maybeSingle();
  if (!doc?.storage_key || !isStorageObjectKey(doc.storage_key)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const { data, error } = await admin.storage.from("conference-docs").download(doc.storage_key);
  if (error || !data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const download = new URL(request.url).searchParams.has("download");
  const filename = safeFilename(doc.file_name || "", `${kind}.pdf`);
  const bytes = new Uint8Array(await data.arrayBuffer());
  return new NextResponse(bytes, {
    headers: {
      "content-type": "application/pdf",
      "cache-control": "public, max-age=60",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
    },
  });
}
