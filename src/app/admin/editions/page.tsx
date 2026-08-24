import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getAllEditionsAdmin } from "@/lib/data";

export const metadata: Metadata = { title: "Editions" };

export default async function AdminEditionsPage() {
  const editions = await getAllEditionsAdmin();
  return (
    <Container className="py-12">
      <PageHeader eyebrow="Admin" title="Editions" />
      <AdminNav current="/admin/editions" />
      <div className="mb-6">
        <Link
          href="/admin/editions/new"
          className="inline-flex h-10 items-center rounded-sm bg-gold-700 px-4 text-sm font-medium text-parchment-50"
        >
          New edition
        </Link>
      </div>
      <div className="grid gap-3">
        {editions.map((edition) => (
          <Link key={edition.id} href={`/admin/editions/${edition.id}`}>
            <Card className="flex flex-wrap items-center justify-between gap-3 hover:bg-parchment-100">
              <div>
                <p className="font-serif text-xl">{edition.name}</p>
                <p className="text-sm text-ink-muted">
                  {edition.year} · {edition.status}
                  {edition.is_public_active ? " · public active" : ""}
                </p>
              </div>
              <span className="text-sm text-gold-700">Edit</span>
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  );
}
