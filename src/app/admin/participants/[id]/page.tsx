import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteParticipantForm, ParticipantPasswordForm } from "@/components/admin/participant-forms";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission, isProtectedAdminAccount } from "@/lib/auth";
import { getAdminParticipant } from "@/lib/data";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = { title: "Participant" };

export default async function AdminParticipantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const canView = await hasPermission("registration.view");
  if (!canView) {
    return (
      <Container className="py-12">
        <PageHeader eyebrow="Staff" title="Participant" description="You need registration.view." />
      </Container>
    );
  }

  const participant = await getAdminParticipant(id);
  if (!participant) notFound();
  const canEdit = await hasPermission("registration.edit", participant.edition_id);
  const protectedAdmin = await isProtectedAdminAccount(participant.user_id, participant.email);
  const canChangePassword = protectedAdmin
    ? await hasPermission("users.manage")
    : canEdit;

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Staff"
        title={participant.full_name}
        description={`${participant.email}${participant.committee_short_name ? ` · ${participant.committee_short_name}` : ""}${participant.collective_name ? ` · ${participant.collective_name}` : ""}`}
      />
      <p className="mb-6">
        <Link href="/admin/participants" className="text-sm text-gold-700 hover:underline">
          Back to participants
        </Link>
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <p className="mb-2 font-serif text-2xl text-gold-700">Status</p>
          <p className="text-sm text-ink-muted">
            {participant.status}
            {participant.paid ? " · payment verified or under review" : " · not yet paid"}
          </p>
        </Card>
        {canChangePassword ? (
          <Card>
            <p className="mb-4 font-serif text-2xl text-gold-700">Password</p>
            {protectedAdmin ? (
              <p className="mb-4 text-sm text-ink-muted">Only an admin can set this password.</p>
            ) : null}
            <ParticipantPasswordForm registrationId={participant.id} />
          </Card>
        ) : null}
        {canEdit && !protectedAdmin ? (
          <Card>
            <p className="mb-4 font-serif text-2xl text-gold-700">Delete</p>
            <DeleteParticipantForm participant={participant} />
          </Card>
        ) : null}
        {protectedAdmin ? (
          <Card>
            <p className="mb-2 font-serif text-2xl text-gold-700">Protected account</p>
            <p className="text-sm text-ink-muted">
              The admin account cannot be deleted. An admin can change its password.
            </p>
          </Card>
        ) : null}
      </div>
    </Container>
  );
}
