import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilters, AdminListShell, AdminPagination, AdminTable } from "@/components/admin/admin-filters";
import { RegenerateQrForm } from "@/components/admin/regenerate-qr-form";
import { Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getAllEditionsAdmin, getConfirmedCredentials } from "@/lib/data";
import { formatDelegation } from "@/lib/format";
import { adminListHref, matchesQuery, paginate, parsePage } from "@/lib/search";

export const metadata: Metadata = { title: "Credentials" };

export default async function AdminCredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string; q?: string; page?: string }>;
}) {
  const { edition: editionId, q = "", page: pageRaw } = await searchParams;
  const allowed = await hasPermission("registration.view");
  if (!allowed) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Credentials"
          description="You need registration.view to list confirmed delegates."
        />
      </Container>
    );
  }

  const [editions, allRows, canRegenerate] = await Promise.all([
    getAllEditionsAdmin(),
    getConfirmedCredentials(editionId || null),
    hasPermission("qr.regenerate"),
  ]);
  const rows = allRows.filter((row) =>
    matchesQuery(
      q,
      row.full_name,
      row.email,
      row.committee_short_name,
      row.display_code,
      row.allocated_portfolio,
      row.collective_name,
    ),
  );
  const paged = paginate(rows, parsePage(pageRaw));
  const query = { q, edition: editionId };

  return (
    <AdminListShell
      header={<h1 className="font-serif text-xl text-gold-700">Credentials</h1>}
      footer={
        <AdminPagination
          page={paged.page}
          pageCount={paged.pageCount}
          total={paged.total}
          from={paged.from}
          to={paged.to}
          makeHref={(next) => adminListHref("/admin/credentials", query, next)}
        />
      }
      toolbar={
        <>
          {editions.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              <Link href={adminListHref("/admin/credentials", { q }, 1)} className="text-sm text-gold-700 hover:underline">
                All editions
              </Link>
              {editions.map((edition) => (
                <Link
                  key={edition.id}
                  href={adminListHref("/admin/credentials", { q, edition: edition.id }, 1)}
                  className="text-sm text-gold-700 hover:underline"
                >
                  {edition.name}
                </Link>
              ))}
            </div>
          ) : null}
          <AdminFilters action="/admin/credentials" q={q}>
            {editionId ? <input type="hidden" name="edition" value={editionId} className="hidden" /> : null}
          </AdminFilters>
        </>
      }
    >
      {paged.items.length ? (
        <AdminTable columns={["Name", "Committee", "Collective", "Delegation", "QR", ""]}>
          {paged.items.map((row) => (
            <tr key={row.id} className="border-b border-gold-700/10 hover:bg-parchment-100">
              <td className="px-2 py-1.5">
                <p className="font-medium">{row.full_name}</p>
                <p className="text-xs text-ink-muted">{row.email}</p>
              </td>
              <td className="px-2 py-1.5 text-ink-muted">{row.committee_short_name ?? "—"}</td>
              <td className="px-2 py-1.5 text-ink-muted">{row.collective_name ?? "—"}</td>
              <td className="px-2 py-1.5 text-ink-muted">
                {formatDelegation(row.allocated_slr, row.allocated_portfolio) ?? "—"}
              </td>
              <td className="px-2 py-1.5 font-mono text-sm tracking-wider">
                {row.display_code ?? "None"}
              </td>
              <td className="px-2 py-1.5 text-right">
                {canRegenerate ? <RegenerateQrForm registrationId={row.id} compact /> : null}
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <p className="text-sm text-ink-muted">No confirmed registrations yet.</p>
      )}
    </AdminListShell>
  );
}
