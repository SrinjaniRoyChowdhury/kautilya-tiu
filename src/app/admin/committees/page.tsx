import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { formatInrFromMinor } from "@/lib/format";
import { getAllEditionsAdmin, getCommitteesForEdition } from "@/lib/data";
import { canDownloadCommitteeAllocations } from "@/lib/reports";

export const metadata: Metadata = { title: "Committees" };

export default async function AdminCommitteesPage() {
  const editions = await getAllEditionsAdmin();
  const committees = (
    await Promise.all(editions.map((edition) => getCommitteesForEdition(edition.id)))
  ).flat();
  const editionName = Object.fromEntries(editions.map((e) => [e.id, e.name]));
  const canCreate = await hasPermission("committee.manage");
  const canDownload = await canDownloadCommitteeAllocations();

  return (
    <Container className="py-12">
      <PageHeader eyebrow="Admin" title="Committees" />
      <AdminNav current="/admin/committees" />
      {canCreate ? (
        <div className="mb-6">
          <Link
            href="/admin/committees/new"
            className="inline-flex h-10 items-center rounded-sm bg-gold-700 px-4 text-sm font-medium text-parchment-50"
          >
            New committee
          </Link>
        </div>
      ) : null}
      <div className="grid gap-3">
        {committees.map((committee) => (
          <Card key={committee.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-serif text-xl">
                {committee.short_name} · {committee.name}
              </p>
              <p className="text-sm text-ink-muted">
                {editionName[committee.edition_id]} · {formatInrFromMinor(committee.fee_minor)} ·{" "}
                {committee.confirmed_count}/{committee.portfolio_config.length || committee.capacity}{" "}
                delegations · {committee.status}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {canDownload ? (
                <a
                  href={`/admin/reports/committee/${committee.id}`}
                  className="text-sm text-gold-700 hover:underline"
                >
                  Download
                </a>
              ) : null}
              <Link href={`/admin/committees/${committee.id}`} className="text-sm text-gold-700 hover:underline">
                Edit
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </Container>
  );
}
