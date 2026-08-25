import type { Metadata } from "next";
import { AdminFilters, AdminListShell, AdminPagination } from "@/components/admin/admin-filters";
import { AdminNav } from "@/components/admin/admin-nav";
import { AuditRow } from "@/components/admin/audit-row";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { paymentHrefFromAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/auth";
import { getAuditActions, getAuditLogs, getPaymentIdsForParticipants } from "@/lib/data";
import { adminListHref, istDayEndIso, istDayStartIso, matchesQuery, paginate, parsePage } from "@/lib/search";

export const metadata: Metadata = { title: "Audit log" };

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; from?: string; to?: string; page?: string }>;
}) {
  const { q = "", action = "", from = "", to = "", page: pageRaw } = await searchParams;
  const allowed = await hasPermission("audit.view");
  if (!allowed) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Audit log"
          description="You need audit.view to read secretariat actions."
        />
      </Container>
    );
  }

  const [actions, rows] = await Promise.all([
    getAuditActions(),
    getAuditLogs({
      action: action || undefined,
      from: from ? (istDayStartIso(from) ?? undefined) : undefined,
      to: to ? (istDayEndIso(to) ?? undefined) : undefined,
    }),
  ]);
  const visible = rows.filter((row) =>
    matchesQuery(q, row.action, row.entity, row.actor_name, row.actor_email, row.entity_id),
  );
  const paged = paginate(visible, parsePage(pageRaw));
  const query = { q, action, from, to };
  const participantIds = paged.items
    .filter((row) => row.action.startsWith("payment.") && row.entity === "payment_participants" && row.entity_id)
    .map((row) => row.entity_id as string);
  const participantPayments = await getPaymentIdsForParticipants(participantIds);

  return (
    <AdminListShell
      header={
        <h1 className="font-serif text-2xl text-gold-700">Audit log</h1>
      }
      footer={
        <AdminPagination
          page={paged.page}
          pageCount={paged.pageCount}
          total={paged.total}
          from={paged.from}
          to={paged.to}
          makeHref={(next) => adminListHref("/admin/audit", query, next)}
        />
      }
      toolbar={
        <>
          <AdminNav current="/admin/audit" className="mb-0" />
          <AdminFilters action="/admin/audit" q={q} qPlaceholder="Actor, action, or record">
            <Field label="Action type" htmlFor="action">
              <Select id="action" name="action" defaultValue={action}>
                <option value="">All actions</option>
                {actions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>
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
      <div className="grid gap-3">
        {paged.items.length ? (
          paged.items.map((row) => (
            <AuditRow
              key={row.id}
              row={row}
              href={
                paymentHrefFromAudit(row) ??
                (row.entity_id && participantPayments.has(row.entity_id)
                  ? `/admin/payments/${participantPayments.get(row.entity_id)}`
                  : null)
              }
            />
          ))
        ) : (
          <Card>
            <p className="text-ink-muted">No audit rows match these filters.</p>
          </Card>
        )}
      </div>
    </AdminListShell>
  );
}
