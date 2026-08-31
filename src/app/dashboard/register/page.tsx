import type { Metadata } from "next";
import { DashboardNav, dashboardNavProps } from "@/components/dashboard/dashboard-nav";
import { RegistrationForm } from "@/components/dashboard/registration-form";
import { ResendVerification } from "@/components/dashboard/resend-verification";
import { RulesAcceptance } from "@/components/dashboard/rules-acceptance";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { startRegistrationAction } from "@/app/actions/registrations";
import { getProfile, getSessionUser } from "@/lib/auth";
import {
  getActiveEdition,
  getCoveringPaymentForRegistration,
  getFieldDefinitions,
  getMyRegistration,
  getPublicCommittees,
  getRegistrationValues,
  getConferenceDocuments,
  getCollectives,
  getInstitutions,
} from "@/lib/data";
import { coveringPaymentLocksRegistration } from "@/lib/payments";
import { isRegistrationOpen, needsConferenceRulesAcceptance } from "@/lib/registration";
import type { Edition } from "@/types";

export const metadata: Metadata = { title: "Registration" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ committee?: string }>;
}) {
  const { committee: committeeSlug } = await searchParams;
  const [user, profile, edition, { showTeam }] = await Promise.all([
    getSessionUser(),
    getProfile(),
    getActiveEdition(),
    dashboardNavProps(),
  ]);
  const verified = Boolean(profile?.email_verified_at || user?.email_confirmed_at);

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Participant"
        title="Registration"
        description="One person, one registration per edition. Someone else may pay for you later."
      />
      <DashboardNav current="/dashboard/register" showTeam={showTeam} />

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
  let startError: string | null = null;
  let registration = await getMyRegistration(edition.id);

  if (!registration) {
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

  const docs = await getConferenceDocuments();
  const published = {
    rulebook: docs.some((doc) => doc.kind === "rulebook"),
    guidelines: docs.some((doc) => doc.kind === "guidelines"),
  };

  const covering = await getCoveringPaymentForRegistration(registration.id);
  const paymentConfirmed = covering?.status === "VERIFIED" || registration.status === "CONFIRMED" || registration.status === "PAYMENT_VERIFIED";

  if (needsConferenceRulesAcceptance(registration) && windowState === "open" && !paymentConfirmed) {
    return (
      <Card>
        <RulesAcceptance registrationId={registration.id} published={published} />
      </Card>
    );
  }

  const [fields, committees, values, collectives, institutions] = await Promise.all([
    getFieldDefinitions(edition.id),
    getPublicCommittees(edition.id),
    getRegistrationValues(registration.id),
    getCollectives(),
    getInstitutions(),
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
        collectives={collectives}
        institutions={institutions}
        preferredCommitteeId={preferred?.id}
        paymentLocked={coveringPaymentLocksRegistration(covering?.status)}
      />
    </Card>
  );
}
