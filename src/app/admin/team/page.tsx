import type { Metadata } from "next";
import Link from "next/link";
import { AddTeamMemberModalButton, TeamMembersTable } from "@/components/admin/team-forms";
import { BackLink } from "@/components/ui/back-link";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission, getRoleNames } from "@/lib/auth";
import { isLimitedStaff } from "@/lib/staff-access";
import { getTeamMembersAdmin } from "@/lib/data";

export const metadata: Metadata = { title: "Team" };

export default async function AdminTeamPage() {
  const canEdit = await hasPermission("cms.manage");
  const readOnly = !canEdit;
  if (!canEdit && !isLimitedStaff(await getRoleNames())) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Team"
          description="You need cms.manage to edit names, designations, and USG departments."
        />
      </Container>
    );
  }

  const members = await getTeamMembersAdmin();
  const core = members.filter((member) => (member.section ?? "CORE") === "CORE");
  const usgs = members.filter((member) => member.section === "USG");
  const coreNext = core.length ? Math.max(...core.map((row) => row.display_order)) + 10 : 10;
  const usgNext = usgs.length ? Math.max(...usgs.map((row) => row.display_order)) + 10 : 110;

  return (
    <Container className="py-12">
      <BackLink href="/admin/cms" label="Back to content" />
      <PageHeader
        eyebrow="Staff"
        title="Team"
        description="Core names and designations, plus Under-Secretary-General departments. Changes go live on /team."
      />
      <p className="mb-8 text-sm text-ink-muted">
        Public page:{" "}
        <Link href="/team" className="text-gold-700 hover:underline">
          /team
        </Link>
      </p>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-serif text-2xl text-gold-700">Core Secretariat</p>
            <p className="mt-1 text-sm text-ink-muted">
              Designation is the office. The first published officer is featured on the public page.
            </p>
          </div>
          {canEdit ? (
            <AddTeamMemberModalButton section="CORE" nextOrder={coreNext} label="Add officer" />
          ) : null}
        </div>
        <TeamMembersTable members={core} section="CORE" readOnly={readOnly} />
      </Card>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-serif text-2xl text-gold-700">USG departments</p>
            <p className="mt-1 text-sm text-ink-muted">Department titles with optional officer names.</p>
          </div>
          {canEdit ? (
            <AddTeamMemberModalButton section="USG" nextOrder={usgNext} label="Add department" />
          ) : null}
        </div>
        <TeamMembersTable members={usgs} section="USG" readOnly={readOnly} />
      </Card>
    </Container>
  );
}
