import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilters, AdminListShell, AdminPagination, AdminTable } from "@/components/admin/admin-filters";
import { Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getAdminUsers } from "@/lib/data";
import { formatDateTime12h } from "@/lib/format";
import { adminListHref, matchesQuery, paginate, parsePage } from "@/lib/search";

export const metadata: Metadata = { title: "Users" };

const STATUS_COPY: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PAYMENT_PENDING: "Awaiting pay",
  PAYMENT_VERIFIED: "Pay verified",
  PAYMENT_REJECTED: "Pay rejected",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: pageRaw } = await searchParams;
  const allowed = await hasPermission("registration.view");
  if (!allowed) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Users"
          description="You need registration.view to list signed-up accounts."
        />
      </Container>
    );
  }

  const rows = await getAdminUsers();
  const visible = rows.filter((row) =>
    matchesQuery(
      q,
      row.full_name,
      row.email,
      row.phone,
      row.committee_short_name,
      row.registration_status,
    ),
  );
  const paged = paginate(visible, parsePage(pageRaw));
  const query = { q };

  return (
    <AdminListShell
      header={<h1 className="font-serif text-xl text-gold-700">Users</h1>}
      footer={
        <AdminPagination
          page={paged.page}
          pageCount={paged.pageCount}
          total={paged.total}
          from={paged.from}
          to={paged.to}
          makeHref={(next) => adminListHref("/admin/users", query, next)}
        />
      }
      toolbar={
        <AdminFilters action="/admin/users" q={q} qPlaceholder="Search name, email, or phone" />
      }
    >
      {paged.items.length ? (
        <AdminTable columns={["Name", "Email", "Phone", "Verified", "Signed up", "Registration", ""]}>
          {paged.items.map((row) => (
            <tr key={row.id} className="border-b border-gold-700/10 hover:bg-parchment-100">
              <td className="px-2 py-1.5 font-medium">{row.full_name}</td>
              <td className="px-2 py-1.5 text-ink-muted">{row.email}</td>
              <td className="px-2 py-1.5 font-mono text-ink-muted">{row.phone ?? "—"}</td>
              <td className="px-2 py-1.5 text-ink-muted">{row.email_verified_at ? "Yes" : "No"}</td>
              <td className="px-2 py-1.5 text-ink-muted">{formatDateTime12h(row.created_at)}</td>
              <td className="px-2 py-1.5 text-ink-muted">
                {row.registration_status
                  ? `${row.committee_short_name ?? "No committee"} · ${STATUS_COPY[row.registration_status] ?? row.registration_status}`
                  : "—"}
              </td>
              <td className="px-2 py-1.5 text-right">
                <Link href={`/admin/users/${row.id}`} className="text-gold-700 hover:underline">
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <p className="text-sm text-ink-muted">No signed-up users match this search.</p>
      )}
    </AdminListShell>
  );
}
