import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaymentReviewActions } from "@/components/admin/payment-review";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getDuplicateProofPayments, getPaymentById, paymentProofHref } from "@/lib/data";
import { formatDateTime12h } from "@/lib/format";
import { PAYMENT_STATUS_COPY } from "@/lib/payments";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Review payment" };

export default async function AdminPaymentDetailPage({ params }: Props) {
  const { id } = await params;
  const allowed = await hasPermission("payment.view");
  if (!allowed) {
    return (
      <Container className="py-12">
        <PageHeader eyebrow="Staff" title="Payment" description="You need payment.view to open this record." />
      </Container>
    );
  }

  const payment = await getPaymentById(id);
  if (!payment) notFound();
  const [duplicates, canVerify] = await Promise.all([
    getDuplicateProofPayments(payment.proof_sha256, payment.id),
    hasPermission("payment.verify", payment.edition_id),
  ]);
  const copy = PAYMENT_STATUS_COPY[payment.status];
  const payer = Array.isArray(payment.payer) ? payment.payer[0] : payment.payer;
  const proofHref = paymentProofHref(payment.id, payment.proof_image_key);

  return (
    <Container className="py-12">
      <PageHeader eyebrow="Staff" title={copy.label} description={copy.detail} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-widest text-gold-700">Payer</p>
          <p className="mt-2 font-serif text-2xl">{payer?.full_name ?? "Payer"}</p>
          <p className="text-sm text-ink-muted">{payer?.email}</p>
          <dl className="mt-4 grid gap-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-widest text-gold-700">Transaction date & time</dt>
              <dd className="mt-1 font-medium">{formatDateTime12h(payment.paid_at)}</dd>
            </div>
          </dl>
          {duplicates.length ? (
            <p className="mt-4 rounded-sm bg-parchment-200 px-3 py-2 text-sm" role="status">
              This screenshot hash matches {duplicates.length} other payment
              {duplicates.length === 1 ? "" : "s"}. Possible duplicate — not auto-blocked.
            </p>
          ) : null}
          {proofHref ? (
            <div className="mt-4 grid gap-2">
              <p className="text-xs uppercase tracking-widest text-gold-700">Payment screenshot</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proofHref}
                alt="Payment screenshot"
                className="max-h-[32rem] w-full rounded-sm border border-gold-700/20 bg-parchment-100 object-contain"
              />
              <a
                href={proofHref}
                className="text-sm text-gold-700 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Open screenshot in a new tab
              </a>
            </div>
          ) : (
            <p className="mt-4 rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="status">
              No screenshot on this payment. Ask the payer to upload proof before verifying.
            </p>
          )}
        </Card>
        <Card>
          <PaymentReviewActions payment={payment} canVerify={canVerify} proofHref={proofHref} />
        </Card>
      </div>
    </Container>
  );
}
