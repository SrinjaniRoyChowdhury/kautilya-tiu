import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminFilters, AdminListShell, AdminPagination, AdminTable } from "@/components/admin/admin-filters";
import { Container, PageHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { paymentHrefFromAudit } from "@/lib/audit";
import { isCurrentUserSuperAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import {
  getAuditActions,
  getAuditLogs,
  getManagedStaffAccounts,
  getPaymentIdsForParticipants,
} from "@/lib/data";
import { formatDateTime12h } from "@/lib/format";
import { adminListHref, istDayEndIso, istDayStartIso, matchesQuery, paginate, parsePage } from "@/lib/search";
import { ACCOUNT_KIND_LABELS } from "@/lib/username";

export const metadata: Metadata = { title: "Account activity" };

export default async function AccountActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; action?: string; from?: string; to?: string; page?: string }>;
}) {
  const { id } = await params;
  const { q = "", action = "", from = "", to = "", page: pageRaw } = await searchParams;

  if (!(await isCurrentUserSuperAdmin())) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Account activity"
          description="Only a Super Admin can view staff account activity."
        />
      </Container>
    );
  }

  if (!isUuid(id)) notFound();

  const accounts = await getManagedStaffAccounts();
  const account = accounts.find((row) => row.user_id === id);
  if (!account) notFound();

  const [actions, rows] = await Promise.all([
    getAuditActions(),
    getAuditLogs({
      actorUserId: id,
      action: action || undefined,
      from: from ? (istDayStartIso(from) ?? undefined) : undefined,
      to: to ? (istDayEndIso(to) ?? undefined) : undefined,
      limit: 1000,
    }),
  ]);

  const visible = rows.filter((row) => {
    const reason =
      row.new_value && typeof row.new_value === "object"
        ? (row.new_value as { reason?: string }).reason
        : undefined;
    return matchesQuery(q, row.action, row.entity, row.entity_id, reason);
  });
  const paged = paginate(visible, parsePage(pageRaw));
  const query = { q, action, from, to };
  const participantIds = paged.items
    .filter((row) => row.action.startsWith("payment.") && row.entity === "payment_participants" && row.entity_id)
    .map((row) => row.entity_id as string);
  const participantPayments = await getPaymentIdsForParticipants(participantIds);
  const displayName = account.username ?? account.full_name;

  return (
    <AdminListShell
      header={
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-serif text-xl text-gold-700">Activity · {displayName}</h1>
          <span className="text-sm text-ink-muted">
            {account.full_name} · {ACCOUNT_KIND_LABELS[account.kind]}
          </span>
          <Link href="/admin/accounts" className="text-sm text-gold-700 hover:underline">
            Back to accounts
          </Link>
        </div>
      }
      footer={
        <AdminPagination
          page={paged.page}
          pageCount={paged.pageCount}
          total={paged.total}
          from={paged.from}
          to={paged.to}
          makeHref={(next) => adminListHref(`/admin/accounts/${id}/activity`, query, next)}
        />
      }
      toolbar={
        <AdminFilters
          action={`/admin/accounts/${id}/activity`}
          q={q}
          qPlaceholder="Action, record, or reason"
        >
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
      }
    >
      {paged.items.length ? (
        <AdminTable columns={["When", "Action", "Record", ""]}>
          {paged.items.map((row) => {
            const href =
              paymentHrefFromAudit(row) ??
              (row.entity_id && participantPayments.has(row.entity_id)
                ? `/admin/payments/${participantPayments.get(row.entity_id)}`
                : null);
            const newVal =
              row.new_value && typeof row.new_value === "object"
                ? (row.new_value as { reason?: string; authorized_by?: string })
                : null;
            return (
              <tr key={row.id} className="border-b border-gold-700/10 hover:bg-parchment-100">
                <td className="whitespace-nowrap px-2 py-1.5 text-xs text-ink-muted">
                  {formatDateTime12h(row.created_at)}
                </td>
                <td className="px-2 py-1.5 font-mono text-xs text-gold-700">
                  {row.action}
                  {newVal?.reason ? (
                    <div className="mt-1 max-w-sm rounded border border-red-200 bg-red-50/90 px-1.5 py-0.5 font-sans text-xs text-red-800">
                      <span className="font-semibold">Reason:</span> {newVal.reason}
                      {newVal.authorized_by ? (
                        <span className="block text-[11px] text-ink-muted">Auth: {newVal.authorized_by}</span>
                      ) : null}
                    </div>
                  ) : null}
                </td>
                <td className="px-2 py-1.5 text-xs text-ink-muted">
                  {row.entity}
                  {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ""}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {href ? (
                    <Link href={href} className="text-gold-700 hover:underline">
                      Open
                    </Link>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </AdminTable>
      ) : (
        <p className="text-sm text-ink-muted">No audited actions for this account yet.</p>
      )}
    </AdminListShell>
  );
}
