import type { Metadata } from "next";
import Link from "next/link";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission, getRoleNames } from "@/lib/auth";
import { isContentEditorOnly, isReadOnlyStaff } from "@/lib/staff-access";
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
  const roles = await getRoleNames();
  const readOnly = isReadOnlyStaff(roles);
  const contentOnly = isContentEditorOnly(roles);

  return (
    <Container className="py-12">
      <PageHeader eyebrow="Admin" title="Committees" />
      <div className="mb-6 flex flex-wrap gap-3">
        {canCreate ? (
          <Link
            href="/admin/committees/new"
            className="inline-flex h-10 items-center rounded-sm bg-gold-700 px-4 text-sm font-medium text-parchment-50"
          >
            New committee
          </Link>
        ) : null}
        {!readOnly && (canCreate || contentOnly) ? (
          <Link
            href="/admin/committees/eb"
            className="inline-flex h-10 items-center rounded-sm border border-gold-700/50 px-4 text-sm font-medium text-gold-700 hover:bg-parchment-200"
          >
            Executive board
          </Link>
        ) : null}
      </div>
      <div className="grid gap-3">
        {committees.map((committee) => (
          <Card key={committee.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-serif text-xl">
                {committee.short_name} · {committee.name}
              </p>
              <p className="text-sm text-ink-muted">
                {editionName[committee.edition_id]}
                {contentOnly ? null : (
                  <>
                    {" "}
                    · {formatInrFromMinor(committee.fee_minor)} ·{" "}
                    {committee.confirmed_count}/{committee.portfolio_config.length || committee.capacity}{" "}
                    delegations · {committee.status}
                  </>
                )}
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
                {readOnly ? "View" : contentOnly ? "Edit public details" : "Edit"}
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </Container>
  );
}
