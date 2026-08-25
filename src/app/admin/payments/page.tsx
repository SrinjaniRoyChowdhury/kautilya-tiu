import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getAdminPayments, getAllEditionsAdmin } from "@/lib/data";
import { formatDateTime12h, formatInrFromMinor } from "@/lib/format";
import { AMOUNT_FLAG_COPY, PAYMENT_STATUS_COPY, participantEmail } from "@/lib/payments";
import type { PaymentStatus } from "@/types";

export const metadata: Metadata = { title: "Payments" };

const FILTERS: Array<{ id: string; label: string; statuses?: PaymentStatus[] }> = [
  { id: "queue", label: "Review queue", statuses: ["PENDING", "UNDER_REVIEW"] },
  { id: "all", label: "All" },
  { id: "verified", label: "Verified", statuses: ["VERIFIED"] },
  { id: "rejected", label: "Rejected", statuses: ["REJECTED"] },
];

function payerName(payment: Awaited<ReturnType<typeof getAdminPayments>>[number]) {
  const payer = Array.isArray(payment.payer) ? payment.payer[0] : payment.payer;
  return payer?.full_name ?? payer?.email ?? "Payer";
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; edition?: string }>;
}) {
  const { filter = "queue", edition: editionId } = await searchParams;
  const allowed = await hasPermission("payment.view");
  if (!allowed) {
    return (
      <Container className="py-12">
        <PageHeader eyebrow="Staff" title="Payments" description="You need payment.view to open this queue." />
      </Container>
    );
  }

  const [editions, payments] = await Promise.all([
    getAllEditionsAdmin(),
    getAdminPayments(editionId || null),
  ]);
  const activeFilter = FILTERS.find((item) => item.id === filter) ?? FILTERS[0];
  const visible = activeFilter.statuses
    ? payments.filter((item) => activeFilter.statuses?.includes(item.status))
    : payments;

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Staff"
        title="Payment queue"
        description="Proof image, declared vs expected amount, difference flag, and linked participants."
      />
      <AdminNav current="/admin/payments" />
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.id}
            href={`/admin/payments?filter=${item.id}${editionId ? `&edition=${editionId}` : ""}`}
            className={
              item.id === activeFilter.id
                ? "rounded-sm bg-gold-700 px-3 py-1.5 text-sm text-parchment-50"
                : "rounded-sm border border-gold-700/25 px-3 py-1.5 text-sm text-gold-700"
            }
          >
            {item.label}
          </Link>
        ))}
      </div>
      {editions.length > 1 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link href={`/admin/payments?filter=${activeFilter.id}`} className="text-sm text-gold-700 hover:underline">
            All editions
          </Link>
          {editions.map((edition) => (
            <Link
              key={edition.id}
              href={`/admin/payments?filter=${activeFilter.id}&edition=${edition.id}`}
              className="text-sm text-gold-700 hover:underline"
            >
              {edition.name}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3">
        {visible.length ? (
          visible.map((payment) => (
            <Link key={payment.id} href={`/admin/payments/${payment.id}`}>
              <Card className="hover:bg-parchment-100">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-xl">{payerName(payment)}</p>
                    <p className="text-sm text-ink-muted">
                      {PAYMENT_STATUS_COPY[payment.status].label} ·{" "}
                      {AMOUNT_FLAG_COPY[payment.amount_flag]} ·{" "}
                      {formatInrFromMinor(payment.paid_amount_minor ?? 0)} paid /{" "}
                      {formatInrFromMinor(payment.expected_amount_minor)} expected
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {payment.proof_image_key ? "Screenshot attached" : "No screenshot"} ·{" "}
                      {formatDateTime12h(payment.paid_at)}
                    </p>
                    <p className="mt-2 text-xs text-ink-muted">
                      {payment.payment_participants.map(participantEmail).join(", ")}
                    </p>
                  </div>
                  <span className="text-sm text-gold-700">Review</span>
                </div>
              </Card>
            </Link>
          ))
        ) : (
          <Card>
            <p className="text-ink-muted">No payments in this filter.</p>
          </Card>
        )}
      </div>
    </Container>
  );
}
