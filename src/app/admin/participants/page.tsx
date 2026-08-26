import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilters, AdminListShell, AdminPagination, AdminTable } from "@/components/admin/admin-filters";
import { Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getAdminParticipants, getAllEditionsAdmin } from "@/lib/data";
import { adminListHref, matchesQuery, paginate, parsePage } from "@/lib/search";

export const metadata: Metadata = { title: "Participants" };

const STATUS_COPY: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PAYMENT_PENDING: "Awaiting pay",
  PAYMENT_VERIFIED: "Pay verified",
  PAYMENT_REJECTED: "Pay rejected",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

export default async function AdminParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; edition?: string; page?: string }>;
}) {
  const { q = "", edition: editionId, page: pageRaw } = await searchParams;
  const allowed = await hasPermission("registration.view");
  if (!allowed) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Participants"
          description="You need registration.view to list delegates."
        />
      </Container>
    );
  }

  const [editions, rows] = await Promise.all([
    getAllEditionsAdmin(),
    getAdminParticipants(editionId || null),
  ]);
  const visible = rows.filter((row) =>
    matchesQuery(q, row.full_name, row.email, row.committee_short_name, row.status, row.collective_name),
  );
  const paged = paginate(visible, parsePage(pageRaw));
  const query = { q, edition: editionId };

  return (
    <AdminListShell
      header={<h1 className="font-serif text-xl text-gold-700">Participants</h1>}
      footer={
        <AdminPagination
          page={paged.page}
          pageCount={paged.pageCount}
          total={paged.total}
          from={paged.from}
          to={paged.to}
          makeHref={(next) => adminListHref("/admin/participants", query, next)}
        />
      }
      toolbar={
        <>
          {editions.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              <Link href={adminListHref("/admin/participants", { q }, 1)} className="text-sm text-gold-700 hover:underline">
                All editions
              </Link>
              {editions.map((edition) => (
                <Link
                  key={edition.id}
                  href={adminListHref("/admin/participants", { q, edition: edition.id }, 1)}
                  className="text-sm text-gold-700 hover:underline"
                >
                  {edition.name}
                </Link>
              ))}
            </div>
          ) : null}
          <AdminFilters action="/admin/participants" q={q}>
            {editionId ? <input type="hidden" name="edition" value={editionId} className="hidden" /> : null}
          </AdminFilters>
        </>
      }
    >
      {paged.items.length ? (
        <AdminTable columns={["Name", "Email", "Committee", "Collective", "Delegation", "Status", ""]}>
          {paged.items.map((row) => (
            <tr key={row.id} className="border-b border-gold-700/10 hover:bg-parchment-100">
              <td className="px-2 py-1.5 font-medium">{row.full_name}</td>
              <td className="px-2 py-1.5 text-ink-muted">{row.email}</td>
              <td className="px-2 py-1.5 text-ink-muted">{row.committee_short_name ?? "—"}</td>
              <td className="px-2 py-1.5 text-ink-muted">{row.collective_name ?? "—"}</td>
              <td className="px-2 py-1.5 text-ink-muted">
                {row.delegation_type === "DOUBLE" ? "Double" : "Single"}
                {row.partner_email ? ` · ${row.partner_email}` : ""}
              </td>
              <td className="px-2 py-1.5 text-ink-muted">
                {STATUS_COPY[row.status] ?? row.status}
                {row.paid ? " · paid" : ""}
              </td>
              <td className="px-2 py-1.5 text-right">
                <Link href={`/admin/participants/${row.id}`} className="text-gold-700 hover:underline">
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <p className="text-sm text-ink-muted">No participants match this search.</p>
      )}
    </AdminListShell>
  );
}
