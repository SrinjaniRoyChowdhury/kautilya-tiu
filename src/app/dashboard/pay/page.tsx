import type { Metadata } from "next";
import Link from "next/link";
import { StartPaymentForm } from "@/components/dashboard/start-payment-form";
import { Card, PageHeader } from "@/components/ui/card";
import { getProfile, getSessionUser } from "@/lib/auth";
import { getActiveEdition, getMyPayments, getMyRegistration } from "@/lib/data";
import { formatInrFromMinor } from "@/lib/format";
import { PAYMENT_STATUS_COPY } from "@/lib/payments";
import { isPayableRegistration } from "@/lib/registration";

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
  const canIncludeSelf = isPayableRegistration(registration?.status);

  return (
    <>
      <PageHeader
        eyebrow="Participant"
        title="Payment"
        description="Pay after your committee is allocated. Someone else may still pay for you in one UPI transfer."
      />

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
              {registration?.status === "SUBMITTED"
                ? "Payment is locked until the secretariat allocates your committee and portfolio. The fee depends on the allotted committee."
                : "Search for people who have already been allocated a committee. The amount is taken from each linked form."}
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
                        prefetch
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
    </>
  );
}
