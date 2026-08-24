import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { RegistrationForm } from "@/components/dashboard/registration-form";
import { ResendVerification } from "@/components/dashboard/resend-verification";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { startRegistrationAction } from "@/app/actions/registrations";
import { getProfile, getSessionUser } from "@/lib/auth";
import {
  getActiveEdition,
  getFieldDefinitions,
  getMyRegistration,
  getPublicCommittees,
  getRegistrationValues,
} from "@/lib/data";
import { isRegistrationOpen } from "@/lib/registration";
import type { Edition } from "@/types";

export const metadata: Metadata = { title: "Registration" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ committee?: string }>;
}) {
  const { committee: committeeSlug } = await searchParams;
  const [user, profile, edition] = await Promise.all([
    getSessionUser(),
    getProfile(),
    getActiveEdition(),
  ]);
  const verified = Boolean(profile?.email_verified_at || user?.email_confirmed_at);

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Participant"
        title="Registration"
        description="One person, one registration per edition. Someone else may pay for you later."
      />
      <DashboardNav current="/dashboard/register" />

      {!verified ? (
        <Card>
          <p className="font-serif text-xl text-gold-700">Verify your email first</p>
          <p className="mt-2 text-sm text-ink-muted">
            Registration is blocked until the account is verified. Locally the link lands in Inbucket
            on port 54324.
          </p>
          <ResendVerification />
        </Card>
      ) : !edition ? (
        <Card>
          <p className="text-ink-muted">No public-active edition is open.</p>
        </Card>
      ) : (
        <RegistrationBody edition={edition} committeeSlug={committeeSlug} />
      )}
    </Container>
  );
}

async function RegistrationBody({
  edition,
  committeeSlug,
}: {
  edition: Edition;
  committeeSlug?: string;
}) {
  const windowState = isRegistrationOpen(edition);
  if (windowState !== "open") {
    return (
      <Card>
        <p className="text-ink-muted">
          {windowState === "not_open"
            ? "Registration has not opened yet."
            : "Registration is closed for this edition."}
        </p>
      </Card>
    );
  }

  let startError: string | null = null;
  let registration = await getMyRegistration(edition.id);
  if (!registration) {
    try {
      registration = await startRegistrationAction(edition.id);
    } catch (error) {
      startError = error instanceof Error ? error.message : "Could not start registration.";
    }
  }

  if (!registration) {
    return (
      <Card>
        <p className="text-sm text-red-800" role="alert">
          {startError ?? "Could not start registration."}
        </p>
      </Card>
    );
  }

  const [fields, committees, values] = await Promise.all([
    getFieldDefinitions(edition.id),
    getPublicCommittees(edition.id),
    getRegistrationValues(registration.id),
  ]);
  const preferred = committees.find((item) => item.slug === committeeSlug);
  const visible = committees.filter(
    (item) => item.status === "OPEN" || item.id === registration.committee_id,
  );

  return (
    <Card>
      <RegistrationForm
        editionId={edition.id}
        registration={registration}
        fields={fields}
        committees={visible}
        values={values}
        preferredCommitteeId={preferred?.id}
      />
    </Card>
  );
}
