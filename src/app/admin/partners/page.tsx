import type { Metadata } from "next";
import Link from "next/link";
import {
  AddCollaboratorModalButton,
  AddSponsorModalButton,
  CollaboratorsTable,
  SponsorsTable,
} from "@/components/admin/partner-forms";
import { BackLink } from "@/components/ui/back-link";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission, getRoleNames } from "@/lib/auth";
import { getCollaboratorsAdmin, getSponsorsAdmin } from "@/lib/data";
import { isLimitedStaff } from "@/lib/staff-access";

export const metadata: Metadata = { title: "Sponsors & collaborators" };

export default async function AdminPartnersPage() {
  const canEdit = await hasPermission("cms.manage");
  const readOnly = !canEdit;
  if (!canEdit && !isLimitedStaff(await getRoleNames())) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Sponsors & collaborators"
          description="You need cms.manage to edit homepage partner logos."
        />
      </Container>
    );
  }

  const [sponsors, collaborators] = await Promise.all([getSponsorsAdmin(), getCollaboratorsAdmin()]);
  const sponsorNext = sponsors.length ? Math.max(...sponsors.map((row) => row.display_order)) + 10 : 10;
  const collaboratorNext = collaborators.length
    ? Math.max(...collaborators.map((row) => row.display_order)) + 10
    : 10;

  return (
    <Container className="py-12">
      <BackLink href="/admin/cms" label="Back to content" />
      <PageHeader
        eyebrow="Staff"
        title="Sponsors & collaborators"
        description="Manage partner logos on the homepage. Each entry needs a name, category, and optional logo."
      />
      <p className="mb-8 text-sm text-ink-muted">
        Public sections:{" "}
        <Link href="/#collaborators" className="text-gold-700 hover:underline">
          Collaborators
        </Link>
        {" · "}
        <Link href="/#sponsors" className="text-gold-700 hover:underline">
          Sponsors
        </Link>
      </p>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-serif text-2xl text-gold-700">Collaborators</p>
            <p className="mt-1 text-sm text-ink-muted">
              Societies, institutions, and teams shown in the collaborators section.
            </p>
          </div>
          {canEdit ? <AddCollaboratorModalButton nextOrder={collaboratorNext} /> : null}
        </div>
        <CollaboratorsTable collaborators={collaborators} readOnly={readOnly} />
      </Card>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-serif text-2xl text-gold-700">Sponsors</p>
            <p className="mt-1 text-sm text-ink-muted">
              Title, gold, silver, and partner tiers on the sponsors section.
            </p>
          </div>
          {canEdit ? <AddSponsorModalButton nextOrder={sponsorNext} /> : null}
        </div>
        <SponsorsTable sponsors={sponsors} readOnly={readOnly} />
      </Card>
    </Container>
  );
}
