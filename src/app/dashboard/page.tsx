import type { Metadata } from "next";
import Link from "next/link";
import { DashboardNav, dashboardNavProps } from "@/components/dashboard/dashboard-nav";
import { RegistrationStatusCard } from "@/components/dashboard/status-card";
import { ResendVerification } from "@/components/dashboard/resend-verification";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getProfile, getRoleNames, getSessionUser, hasScanAccess } from "@/lib/auth";
import {
  getActiveEdition,
  getActiveQrForRegistration,
  getCommitteesForEdition,
  getCoveringPaymentForRegistration,
  getMyEventStatus,
  getMyRegistration,
} from "@/lib/data";
import { formatInrFromMinor } from "@/lib/format";
import { PAYMENT_STATUS_COPY } from "@/lib/payments";
import { isRegistrationOpen } from "@/lib/registration";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [user, profile, roles, edition, canScan] = await Promise.all([
    getSessionUser(),
    getProfile(),
    getRoleNames(),
    getActiveEdition(),
    hasScanAccess(),
  ]);

  const verified = Boolean(profile?.email_verified_at || user?.email_confirmed_at);
  const registration = edition ? await getMyRegistration(edition.id) : null;
  const committees = edition ? await getCommitteesForEdition(edition.id) : [];
  const committee = committees.find((item) => item.id === registration?.committee_id) ?? null;
  const windowState = edition ? isRegistrationOpen(edition) : "closed";
  const covering = registration ? await getCoveringPaymentForRegistration(registration.id) : null;
  const eventStatus =
    registration?.status === "CONFIRMED" ? await getMyEventStatus(registration.id) : null;
  const qr =
    registration?.status === "CONFIRMED"
      ? await getActiveQrForRegistration(registration.id)
      : null;
  const { showTeam } = await dashboardNavProps();

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Participant"
        title={`Hello, ${profile?.full_name ?? "delegate"}`}
        description={edition?.name ?? "No edition is open for registration."}
      />
      <DashboardNav current="/dashboard" showTeam={showTeam} />

      {!verified ? (
        <Card className="mb-6">
          <p className="font-serif text-xl text-gold-700">Verify your email</p>
          <p className="mt-2 text-sm text-ink-muted">
            You can browse, but you cannot submit a registration or payment until the address is
            verified. Locally the link lands in Inbucket on port 54324.
          </p>
          <ResendVerification />
        </Card>
      ) : null}

      {canScan ? (
        <Card className="mb-6">
          <p className="font-serif text-xl text-gold-700">Desk scanner</p>
          <p className="mt-2 text-sm text-ink-muted">
            Use a laptop webcam to scan a delegate’s QR. On the phone, open Credential and tap the
            QR to enlarge it.
          </p>
          <Link href="/scan" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
            Open scanner
          </Link>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <RegistrationStatusCard registration={registration} committee={committee} />
        <Card>
          <p className="text-xs uppercase tracking-widest text-gold-700">Payment</p>
          <p className="mt-2 font-serif text-2xl">
            {covering
              ? PAYMENT_STATUS_COPY[covering.status].label
              : registration?.status === "PAYMENT_PENDING" ||
                  registration?.status === "PAYMENT_REJECTED"
                ? "Ready to pay"
                : registration?.status === "CONFIRMED"
                  ? "Verified"
                  : "Not started"}
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            {covering
              ? PAYMENT_STATUS_COPY[covering.status].detail
              : "Manual UPI screenshot and group payment. The expected fee is snapshotted when you submit registration."}
          </p>
          {covering?.expected_amount_minor != null ? (
            <p className="mt-2 text-sm">
              Expected {formatInrFromMinor(covering.expected_amount_minor)}
              {covering.paid_amount_minor != null
                ? ` · declared ${formatInrFromMinor(covering.paid_amount_minor)}`
                : ""}
            </p>
          ) : null}
          <Link href="/dashboard/pay" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
            Open payment
          </Link>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gold-700">Account</p>
          <p className="mt-2 text-sm">{profile?.email ?? user?.email}</p>
          <p className="mt-1 text-sm text-ink-muted">
            Email {verified ? "verified" : "not verified"}
          </p>
          <Link href="/dashboard/profile" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
            Edit profile
          </Link>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gold-700">Edition window</p>
          <p className="mt-2 font-serif text-2xl">
            {windowState === "open" ? "Open" : windowState === "not_open" ? "Not yet open" : "Closed"}
          </p>
          <Link href="/committees" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
            Browse committees
          </Link>
        </Card>
        {qr ? (
          <Card>
            <p className="text-xs uppercase tracking-widest text-gold-700">Credential</p>
            <p className="mt-2 font-mono text-2xl tracking-widest">{qr.display_code}</p>
            <p className="mt-2 text-sm text-ink-muted">
              Short display code only. The scannable QR is on Credential — desks do not look this
              slice up.
            </p>
            <Link href="/dashboard/qr" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
              Open credential
            </Link>
          </Card>
        ) : null}
        {eventStatus ? (
          <Card>
            <p className="text-xs uppercase tracking-widest text-gold-700">At the venue</p>
            <p className="mt-2 font-serif text-2xl">
              {eventStatus.attendance.length
                ? `Checked in ${eventStatus.attendance.length}/3 days`
                : "Not checked in yet"}
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              {eventStatus.meals.length
                ? `${eventStatus.meals.length} meal${eventStatus.meals.length === 1 ? "" : "s"} collected`
                : "No meals marked collected yet."}
            </p>
          </Card>
        ) : null}
        {roles.length ? (
          <Card className="sm:col-span-2">
            <p className="text-xs uppercase tracking-widest text-gold-700">Staff roles</p>
            <p className="mt-2 text-sm">{roles.join(", ")}</p>
            <Link href="/admin" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
              Open admin portal
            </Link>
          </Card>
        ) : null}
      </div>
    </Container>
  );
}
