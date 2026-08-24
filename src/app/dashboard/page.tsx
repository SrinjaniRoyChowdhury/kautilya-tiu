import type { Metadata } from "next";
import Link from "next/link";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { RegistrationStatusCard } from "@/components/dashboard/status-card";
import { ResendVerification } from "@/components/dashboard/resend-verification";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getProfile, getRoleNames, getSessionUser } from "@/lib/auth";
import { getActiveEdition, getCommitteesForEdition, getMyRegistration } from "@/lib/data";
import { isRegistrationOpen } from "@/lib/registration";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [user, profile, roles, edition] = await Promise.all([
    getSessionUser(),
    getProfile(),
    getRoleNames(),
    getActiveEdition(),
  ]);

  const verified = Boolean(profile?.email_verified_at || user?.email_confirmed_at);
  const registration = edition ? await getMyRegistration(edition.id) : null;
  const committees = edition ? await getCommitteesForEdition(edition.id) : [];
  const committee = committees.find((item) => item.id === registration?.committee_id) ?? null;
  const windowState = edition ? isRegistrationOpen(edition) : "closed";

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Participant"
        title={`Hello, ${profile?.full_name ?? "delegate"}`}
        description={edition?.name ?? "No edition is open for registration."}
      />
      <DashboardNav current="/dashboard" />

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

      <div className="grid gap-4 sm:grid-cols-2">
        <RegistrationStatusCard registration={registration} committee={committee} />
        <Card>
          <p className="text-xs uppercase tracking-widest text-gold-700">Payment</p>
          <p className="mt-2 font-serif text-2xl">
            {registration?.status === "PAYMENT_PENDING" || registration?.status === "PAYMENT_REJECTED"
              ? "Awaiting Phase 3"
              : registration?.status === "PAYMENT_VERIFIED" || registration?.status === "CONFIRMED"
                ? "Verified"
                : "Not started"}
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Manual UPI / screenshot upload and group payment ship in Phase 3. The expected fee is
            snapshotted when you submit.
          </p>
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
