import type { Metadata } from "next";
import { CommitteeEbPreview, CommitteeEbTable } from "@/components/admin/eb-forms";
import { BackLink } from "@/components/ui/back-link";
import { Container, PageHeader } from "@/components/ui/card";
import { hasPermission, getRoleNames } from "@/lib/auth";
import { isLimitedStaff, isReadOnlyStaff } from "@/lib/staff-access";
import { getAllEditionsAdmin, getCommitteesForEdition } from "@/lib/data";

export const metadata: Metadata = { title: "Executive board" };

export default async function AdminCommitteeEbPage() {
  const roles = await getRoleNames();
  const canContent = await hasPermission("committee.content");
  const canManage = await hasPermission("committee.manage");
  const canEdit = (canContent || canManage) && !isReadOnlyStaff(roles);

  if (!canContent && !canManage && !isLimitedStaff(roles)) {
    return (
      <Container className="py-12">
        <PageHeader eyebrow="Admin" title="Executive board" description="Staff only." />
      </Container>
    );
  }

  const editions = await getAllEditionsAdmin();
  const committees = (
    await Promise.all(editions.map((edition) => getCommitteesForEdition(edition.id)))
  ).flat();
  const editionName = Object.fromEntries(editions.map((e) => [e.id, e.name]));
  const activeEdition = editions.find((e) => e.is_public_active) ?? editions[0] ?? null;

  return (
    <Container className="py-12">
      <BackLink href="/admin/committees" label="Back to committees" />
      <PageHeader
        eyebrow="Admin"
        title="Executive board"
        description="Edit committee executive boards. Members appear on each committee's public page."
      />
      <CommitteeEbPreview edition={activeEdition} />
      <div className="mt-6 overflow-x-auto">
        <CommitteeEbTable committees={committees} editionName={editionName} canEdit={canEdit} />
      </div>
    </Container>
  );
}
