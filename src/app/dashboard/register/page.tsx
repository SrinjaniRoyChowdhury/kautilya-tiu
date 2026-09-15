import type { Metadata } from "next";
import { RegistrationForm } from "@/components/dashboard/registration-form";
import { ResendVerification } from "@/components/dashboard/resend-verification";
import { Card, PageHeader } from "@/components/ui/card";
import { startRegistrationAction } from "@/app/actions/registrations";
import { getProfile, getSessionUser } from "@/lib/auth";
import {
  getActiveEdition,
  getCoveringPaymentForRegistration,
  getFieldDefinitions,
  getMyRegistration,
  getPublicCommittees,
  getRegistrationPreferences,
  getRegistrationValues,
  getConferenceDocLinks,
  getCollectives,
  getInstitutions,
} from "@/lib/data";
import { coveringPaymentLocksRegistration } from "@/lib/payments";
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
    <>
      <PageHeader
        eyebrow="Participant"
        title="Registration"
        description="One person, one registration per edition. Choose 2–3 committees; payment opens after allocation."
      />

      {!verified ? (
        <Card>
          <p className="font-serif text-xl text-gold-700">Verify your email first</p>
          <p className="mt-2 text-sm text-ink-muted">
            Registration is blocked until the account is verified. Check your inbox and spam
            folder, or resend the link below.
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
    </>
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

  const covering = registration ? await getCoveringPaymentForRegistration(registration.id) : null;
  const paymentConfirmed =
    covering?.status === "VERIFIED" ||
    registration?.status === "CONFIRMED" ||
    registration?.status === "PAYMENT_VERIFIED";

  if (windowState !== "open" && !paymentConfirmed) {
    return (
      <Card>
        <p className="text-ink-muted">
          {windowState === "not_open"
            ? "Registration has not opened yet."
            : "Registration is currently closed for this edition."}
        </p>
      </Card>
    );
  }

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

  const [publishedDocs, fields, committees, values, collectives, institutions, preferences] =
    await Promise.all([
      getConferenceDocLinks(),
      getFieldDefinitions(edition.id),
      getPublicCommittees(edition.id),
      getRegistrationValues(registration.id),
      getCollectives(),
      getInstitutions(),
      getRegistrationPreferences(registration.id),
    ]);
  const preferred = committees.find((item) => item.slug === committeeSlug);
  const preferredIds = new Set(preferences.map((item) => item.committee_id));
  const visible = committees.filter(
    (item) =>
      item.status === "OPEN" ||
      item.id === registration.committee_id ||
      preferredIds.has(item.id),
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
        preferences={preferences}
        preferredCommitteeId={preferred?.id}
        paymentLocked={coveringPaymentLocksRegistration(covering?.status)}
        publishedDocs={publishedDocs}
        portfolioMatrixUrl={edition.portfolio_matrix_url}
      />
    </Card>
  );
}
