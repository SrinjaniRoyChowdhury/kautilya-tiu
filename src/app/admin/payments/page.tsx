import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilters, AdminListShell, AdminPagination, AdminTable } from "@/components/admin/admin-filters";
import { Container, PageHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { hasPermission } from "@/lib/auth";
import { getAdminPayments, getAllEditionsAdmin } from "@/lib/data";
import { formatDateTime12h, formatInrFromMinor } from "@/lib/format";
import { AMOUNT_FLAG_COPY, PAYMENT_STATUS_COPY, participantEmail } from "@/lib/payments";
import { adminListHref, inDateRange, matchesQuery, paginate, parsePage } from "@/lib/search";
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
  searchParams: Promise<{ filter?: string; edition?: string; q?: string; from?: string; to?: string; page?: string }>;
}) {
  const { filter = "queue", edition: editionId, q = "", from = "", to = "", page: pageRaw } = await searchParams;
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
  const visible = (activeFilter.statuses
    ? payments.filter((item) => activeFilter.statuses?.includes(item.status))
    : payments
  ).filter((payment) => {
    const payer = Array.isArray(payment.payer) ? payment.payer[0] : payment.payer;
    const emails = payment.payment_participants.map(participantEmail).join(" ");
    const when = payment.paid_at ?? payment.created_at;
    return (
      matchesQuery(q, payerName(payment), payer?.email, emails, payment.transaction_ref, payment.status) &&
      inDateRange(when, from, to)
    );
  });
  const paged = paginate(visible, parsePage(pageRaw));
  const query = { filter: activeFilter.id, edition: editionId, q, from, to };

  return (
    <AdminListShell
      header={<h1 className="font-serif text-xl text-gold-700">Payment queue</h1>}
      footer={
        <AdminPagination
          page={paged.page}
          pageCount={paged.pageCount}
          total={paged.total}
          from={paged.from}
          to={paged.to}
          makeHref={(next) => adminListHref("/admin/payments", query, next)}
        />
      }
      toolbar={
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((item) => (
              <Link
                key={item.id}
                href={adminListHref("/admin/payments", { ...query, filter: item.id }, 1)}
                className={
                  item.id === activeFilter.id
                    ? "shrink-0 rounded-sm bg-gold-700 px-2.5 py-1 text-sm text-parchment-50"
                    : "shrink-0 rounded-sm border border-gold-700/25 px-2.5 py-1 text-sm text-gold-700"
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
          {editions.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={adminListHref("/admin/payments", { ...query, edition: undefined }, 1)}
                className="text-sm text-gold-700 hover:underline"
              >
                All editions
              </Link>
              {editions.map((edition) => (
                <Link
                  key={edition.id}
                  href={adminListHref("/admin/payments", { ...query, edition: edition.id }, 1)}
                  className="text-sm text-gold-700 hover:underline"
                >
                  {edition.name}
                </Link>
              ))}
            </div>
          ) : null}
          <AdminFilters action="/admin/payments" q={q}>
            <input type="hidden" name="filter" value={activeFilter.id} className="hidden" />
            {editionId ? <input type="hidden" name="edition" value={editionId} className="hidden" /> : null}
            <Field label="From" htmlFor="from">
              <Input id="from" name="from" type="date" defaultValue={from} />
            </Field>
            <Field label="To" htmlFor="to">
              <Input id="to" name="to" type="date" defaultValue={to} />
            </Field>
          </AdminFilters>
        </>
      }
    >
      {paged.items.length ? (
        <AdminTable columns={["Payer", "Status", "Amount", "Delegates", "When", ""]}>
          {paged.items.map((payment) => (
            <tr key={payment.id} className="border-b border-gold-700/10 hover:bg-parchment-100">
              <td className="px-2 py-1.5 font-medium">{payerName(payment)}</td>
              <td className="px-2 py-1.5 text-ink-muted">
                {PAYMENT_STATUS_COPY[payment.status].label}
                {payment.proof_image_key ? " · proof" : ""}
              </td>
              <td className="px-2 py-1.5 text-ink-muted">
                {formatInrFromMinor(payment.paid_amount_minor ?? 0)} /{" "}
                {formatInrFromMinor(payment.expected_amount_minor)}
                <span className="ml-1 text-xs">{AMOUNT_FLAG_COPY[payment.amount_flag]}</span>
              </td>
              <td className="max-w-[14rem] truncate px-2 py-1.5 text-xs text-ink-muted">
                {payment.payment_participants.map(participantEmail).join(", ")}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-xs text-ink-muted">
                {formatDateTime12h(payment.paid_at)}
              </td>
              <td className="px-2 py-1.5 text-right">
                <Link href={`/admin/payments/${payment.id}`} className="text-gold-700 hover:underline">
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <p className="text-sm text-ink-muted">No payments in this filter.</p>
      )}
    </AdminListShell>
  );
}
