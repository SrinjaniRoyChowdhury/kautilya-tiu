import type { Metadata } from "next";
import Link from "next/link";
import { TeamMemberForm } from "@/components/admin/team-forms";
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

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Staff"
        title="Team"
        description="Core names and designations, plus Under-Secretary-General departments. Changes go live on /team. Co-holders share one office: write Name & Name."
      />
      <p className="mb-6 text-sm text-ink-muted">
        Public page:{" "}
        <Link href="/team" className="text-gold-700 hover:underline">
          /team
        </Link>
        .
      </p>

      <Card>
        <p className="mb-2 font-serif text-2xl text-gold-700">Core Secretariat</p>
        {readOnly ? (
          <ul className="grid gap-2 text-sm">
            {core.map((member) => (
              <li key={member.id}>
                {member.role_title}: {member.full_name}
              </li>
            ))}
          </ul>
        ) : (
          <>
        <p className="mb-6 text-sm text-ink-muted">
          Designation is the office. Name is who holds it. The first published officer is featured.
        </p>
        <TeamMemberForm
          section="CORE"
          nextOrder={core.length ? Math.max(...core.map((row) => row.display_order)) + 10 : 10}
        />
        <div className="mt-8 grid gap-6">
          {core.length ? (
            core.map((member) => (
              <div key={member.id} className="border-t border-gold-700/15 pt-6">
                <TeamMemberForm section="CORE" member={member} />
              </div>
            ))
          ) : (
            <p className="text-sm text-ink-muted">No core officers yet. The public page shows the fallback roster until you add one.</p>
          )}
        </div>
          </>
        )}
      </Card>

      <Card className="mt-6">
        <p className="mb-2 font-serif text-2xl text-gold-700">Under-Secretary-General departments</p>
        {readOnly ? (
          <ul className="grid gap-2 text-sm">
            {usgs.map((member) => (
              <li key={member.id}>
                {member.role_title}
                {member.full_name ? `: ${member.full_name}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <>
        <p className="mb-6 text-sm text-ink-muted">
          Department titles only unless you add an officer name. Names are optional.
        </p>
        <TeamMemberForm
          section="USG"
          nextOrder={usgs.length ? Math.max(...usgs.map((row) => row.display_order)) + 10 : 110}
        />
        <div className="mt-8 grid gap-6">
          {usgs.length ? (
            usgs.map((member) => (
              <div key={member.id} className="border-t border-gold-700/15 pt-6">
                <TeamMemberForm section="USG" member={member} />
              </div>
            ))
          ) : (
            <p className="text-sm text-ink-muted">No USG departments yet. The public page shows the fallback list until you add one.</p>
          )}
        </div>
          </>
        )}
      </Card>
    </Container>
  );
}
