import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommitteeForm } from "@/components/admin/forms";
import { BackLink } from "@/components/ui/back-link";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission, getRoleNames } from "@/lib/auth";
import { isReadOnlyStaff } from "@/lib/staff-access";
import { getAllEditionsAdmin, getCommitteeById, getCommitteeFeeRows } from "@/lib/data";
import { canDownloadCommitteeAllocations } from "@/lib/reports";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Edit committee" };

export default async function EditCommitteePage({ params }: Props) {
  const { id } = await params;
  const [committee, editions, fees] = await Promise.all([
    getCommitteeById(id),
    getAllEditionsAdmin(),
    getCommitteeFeeRows(id),
  ]);
  if (!committee) notFound();
  const canDownload = await canDownloadCommitteeAllocations(committee.edition_id);
  const canEdit = await hasPermission("committee.manage", committee.edition_id);
  const canContent = await hasPermission("committee.content", committee.edition_id);
  const readOnly = isReadOnlyStaff(await getRoleNames());
  const mode = canEdit ? "full" : canContent && !readOnly ? "content" : "view";

  return (
    <Container className="py-12">
      <BackLink href="/admin/committees" label="Back to committees" />
      <PageHeader
        eyebrow="Admin"
        title={committee.name}
        description={
          canEdit
            ? `Capacity ${committee.capacity}. Allot portfolios manually on each participant.`
            : mode === "content"
              ? "Public name, description, and logo."
              : `${committee.short_name} · ${committee.status}`
        }
      />
      {canDownload ? (
        <p className="mb-6">
          <a
            href={`/admin/reports/committee/${committee.id}`}
            className="inline-flex h-10 items-center rounded-sm border border-gold-700/50 px-4 text-sm font-medium text-gold-700 hover:bg-parchment-200"
          >
            Download allotments
          </a>
        </p>
      ) : null}
      <Card>
        <CommitteeForm editions={editions} committee={committee} fees={fees} mode={mode} />
      </Card>
    </Container>
  );
}
