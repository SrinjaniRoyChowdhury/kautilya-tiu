import type { Metadata } from "next";
import Link from "next/link";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { StartPaymentForm } from "@/components/dashboard/start-payment-form";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getProfile, getSessionUser } from "@/lib/auth";
import { getActiveEdition, getMyPayments, getMyRegistration } from "@/lib/data";
import { formatInrFromMinor } from "@/lib/format";
import { PAYMENT_STATUS_COPY } from "@/lib/payments";

export const metadata: Metadata = { title: "Payment" };

export default async function PayIndexPage() {
  const [user, profile, edition] = await Promise.all([
    getSessionUser(),
    getProfile(),
    getActiveEdition(),
  ]);
  const verified = Boolean(profile?.email_verified_at || user?.email_confirmed_at);
  const registration = edition ? await getMyRegistration(edition.id) : null;
  const payments = edition ? await getMyPayments(edition.id) : [];
  const canIncludeSelf =
    registration?.status === "SUBMITTED" ||
    registration?.status === "PAYMENT_PENDING" ||
    registration?.status === "PAYMENT_REJECTED";

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Participant"
        title="Payment"
        description="Pay for yourself or several delegates in one UPI transfer. Each person still registers individually."
      />
      <DashboardNav current="/dashboard/pay" />

      {!verified ? (
        <Card>
          <p className="text-ink-muted">Verify your email before submitting a payment.</p>
        </Card>
      ) : !edition ? (
        <Card>
          <p className="text-ink-muted">No public-active edition is open.</p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <p className="font-serif text-2xl text-gold-700">New payment</p>
            <p className="mt-2 mb-6 text-sm text-ink-muted">
              Search for people who have already submitted a registration. The amount is taken from
              each linked form — unregistered emails cannot be paid for.
            </p>
            <StartPaymentForm editionId={edition.id} canIncludeSelf={Boolean(canIncludeSelf)} />
          </Card>
          <Card>
            <p className="font-serif text-2xl text-gold-700">Your payments</p>
            {payments.length ? (
              <ul className="mt-4 grid gap-3">
                {payments.map((payment) => {
                  const copy = PAYMENT_STATUS_COPY[payment.status];
                  return (
                    <li key={payment.id}>
                      <Link
                        href={`/dashboard/pay/${payment.id}`}
                        className="block rounded-sm border border-gold-700/20 px-3 py-3 hover:bg-parchment-100"
                      >
                        <p className="font-medium">{copy.label}</p>
                        <p className="text-sm text-ink-muted">
                          {formatInrFromMinor(payment.expected_amount_minor)} expected ·{" "}
                          {payment.payment_participants.length} participant
                          {payment.payment_participants.length === 1 ? "" : "s"}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ink-muted">No payments yet.</p>
            )}
          </Card>
        </div>
      )}
    </Container>
  );
}
