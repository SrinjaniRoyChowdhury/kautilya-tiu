import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { QrLightbox } from "@/components/dashboard/qr-lightbox";
import { ResendQrEmail } from "@/components/dashboard/resend-qr-email";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getProfile, getSessionUser } from "@/lib/auth";
import { getActiveEdition, getActiveQrForRegistration, getCommitteesForEdition, getMyRegistration } from "@/lib/data";
import { formatDelegation } from "@/lib/format";
import { getActiveQrPayload } from "@/lib/qr-mail";

export const metadata: Metadata = { title: "Credential" };

export default async function CredentialPage() {
  const [user, profile, edition] = await Promise.all([
    getSessionUser(),
    getProfile(),
    getActiveEdition(),
  ]);
  const registration = edition ? await getMyRegistration(edition.id) : null;
  const committees = edition ? await getCommitteesForEdition(edition.id) : [];
  const committee = committees.find((item) => item.id === registration?.committee_id) ?? null;
  const qrMeta =
    registration?.status === "CONFIRMED"
      ? await getActiveQrForRegistration(registration.id)
      : null;
  const image =
    registration?.status === "CONFIRMED" ? await getActiveQrPayload(registration.id) : null;

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Participant"
        title="Credential"
        description="Show this QR at every desk. The same code is used all three days and for meals."
      />
      <DashboardNav current="/dashboard/qr" />

      {!registration || registration.status !== "CONFIRMED" ? (
        <Card>
          <p className="font-serif text-2xl text-gold-700">Not confirmed yet</p>
          <p className="mt-2 text-sm text-ink-muted">
            Your scannable credential is issued when the secretariat verifies payment. The short
            display code is not a valid scan target.
          </p>
        </Card>
      ) : image ? (
        <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
          <Card className="flex flex-col items-center text-center">
            <QrLightbox src={image.dataUrl} alt="Niti Sabha credential QR" />
            <p className="mt-4 font-mono text-2xl tracking-widest">{image.displayCode}</p>
            <p className="mt-1 text-xs text-ink-muted">Display code · not valid for lookup</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-widest text-gold-700">Delegate</p>
            <p className="mt-2 font-serif text-2xl">{profile?.full_name ?? user?.email}</p>
            {committee ? (
              <p className="mt-2 text-sm">
                {committee.short_name} · {committee.name}
              </p>
            ) : null}
            {formatDelegation(registration.allocated_slr, registration.allocated_portfolio) ? (
              <p className="mt-1 text-sm">
                Allocated delegation: {formatDelegation(registration.allocated_slr, registration.allocated_portfolio)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">Delegation will appear here after the secretariat allocates it. Your QR stays the same.</p>
            )}
            {registration.food_preference ? (
              <p className="mt-1 text-sm text-ink-muted">Food: {registration.food_preference}</p>
            ) : null}
            {qrMeta?.issued_at ? (
              <p className="mt-1 text-sm text-ink-muted">
                Issued {new Date(qrMeta.issued_at).toLocaleString("en-IN")}
              </p>
            ) : null}
            <p className="mt-4 text-sm text-ink-muted">
              Do not screenshot and share this QR. If a phone is lost, ask the secretariat to
              regenerate it — the old scan will fail immediately.
            </p>
            <ResendQrEmail registrationId={registration.id} />
          </Card>
        </div>
      ) : (
        <Card>
          <p className="text-ink-muted">Confirmed, but no active QR was found. Contact the secretariat.</p>
        </Card>
      )}
    </Container>
  );
}
