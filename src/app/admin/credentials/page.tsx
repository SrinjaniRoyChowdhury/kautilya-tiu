import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilters, AdminListShell, AdminPagination } from "@/components/admin/admin-filters";
import { AdminNav } from "@/components/admin/admin-nav";
import { RegenerateQrForm } from "@/components/admin/regenerate-qr-form";
import { Card, Container, PageHeader } from "@/components/ui/card";
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
    matchesQuery(q, row.full_name, row.email, row.committee_short_name, row.display_code, row.allocated_portfolio),
  );
  const paged = paginate(rows, parsePage(pageRaw));
  const query = { q, edition: editionId };

  return (
    <AdminListShell
      header={
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-700">Staff</p>
          <h1 className="font-serif text-2xl text-gold-700">Credentials</h1>
        </div>
      }
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
          <AdminNav current="/admin/credentials" className="mb-0" />
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
      <div className="grid gap-3">
        {paged.items.length ? (
          paged.items.map((row) => (
            <Card key={row.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-serif text-xl">{row.full_name}</p>
                  <p className="text-sm text-ink-muted">
                    {row.email}
                    {row.committee_short_name ? ` · ${row.committee_short_name}` : ""}
                    {row.food_preference ? ` · ${row.food_preference}` : ""}
                  </p>
                  {formatDelegation(row.allocated_slr, row.allocated_portfolio) ? (
                    <p className="mt-1 text-sm">
                      Allocated delegation: {formatDelegation(row.allocated_slr, row.allocated_portfolio)}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-ink-muted">Delegation not allocated yet</p>
                  )}
                  <p className="mt-2 font-mono text-lg tracking-widest">
                    {row.display_code ?? "No active QR"}
                  </p>
                </div>
                {canRegenerate ? <RegenerateQrForm registrationId={row.id} /> : null}
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-ink-muted">No confirmed registrations yet.</p>
          </Card>
        )}
      </div>
    </AdminListShell>
  );
}
