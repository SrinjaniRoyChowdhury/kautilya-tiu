import type { Metadata } from "next";
import Link from "next/link";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getAllEditionsAdmin } from "@/lib/data";

export const metadata: Metadata = { title: "Editions" };

export default async function AdminEditionsPage() {
  const editions = await getAllEditionsAdmin();
  const canEdit = await hasPermission("edition.manage");
  return (
    <Container className="py-12">
      <PageHeader eyebrow="Admin" title="Editions" />
      {canEdit ? (
      <div className="mb-6">
        <Link
          href="/admin/editions/new"
          className="inline-flex h-10 items-center rounded-sm bg-gold-700 px-4 text-sm font-medium text-parchment-50"
        >
          New edition
        </Link>
      </div>
      ) : null}
      <div className="grid gap-3">
        {editions.map((edition) => (
          <Card key={edition.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-serif text-xl">{edition.name}</p>
                <p className="text-sm text-ink-muted">
                  {edition.year} · {edition.status}
                  {edition.is_public_active ? " · public active" : ""}
                </p>
              </div>
              {canEdit ? (
                <Link href={`/admin/editions/${edition.id}`} className="text-sm text-gold-700 hover:underline">
                  Edit
                </Link>
              ) : (
                <span className="text-sm text-ink-muted">{edition.theme || "—"}</span>
              )}
            </Card>
        ))}
      </div>
    </Container>
  );
}
