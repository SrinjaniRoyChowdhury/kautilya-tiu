import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { formatInrFromMinor } from "@/lib/format";
import { getAllEditionsAdmin, getCommitteesForEdition } from "@/lib/data";

export const metadata: Metadata = { title: "Committees" };

export default async function AdminCommitteesPage() {
  const editions = await getAllEditionsAdmin();
  const committees = (
    await Promise.all(editions.map((edition) => getCommitteesForEdition(edition.id)))
  ).flat();
  const editionName = Object.fromEntries(editions.map((e) => [e.id, e.name]));

  return (
    <Container className="py-12">
      <PageHeader eyebrow="Admin" title="Committees" />
      <AdminNav current="/admin/committees" />
      <div className="mb-6">
        <Link
          href="/admin/committees/new"
          className="inline-flex h-10 items-center rounded-sm bg-gold-700 px-4 text-sm font-medium text-parchment-50"
        >
          New committee
        </Link>
      </div>
      <div className="grid gap-3">
        {committees.map((committee) => (
          <Link key={committee.id} href={`/admin/committees/${committee.id}`}>
            <Card className="flex flex-wrap items-center justify-between gap-3 hover:bg-parchment-100">
              <div>
                <p className="font-serif text-xl">
                  {committee.short_name} · {committee.name}
                </p>
                <p className="text-sm text-ink-muted">
                  {editionName[committee.edition_id]} · {formatInrFromMinor(committee.fee_minor)} ·{" "}
                  {committee.confirmed_count}/{committee.capacity} confirmed · {committee.status}
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
