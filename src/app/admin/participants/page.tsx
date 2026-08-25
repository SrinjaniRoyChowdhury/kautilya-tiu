import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilters, AdminListShell, AdminPagination } from "@/components/admin/admin-filters";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, Container, PageHeader } from "@/components/ui/card";
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
    matchesQuery(q, row.full_name, row.email, row.committee_short_name, row.status),
  );
  const paged = paginate(visible, parsePage(pageRaw));
  const query = { q, edition: editionId };

  return (
    <AdminListShell
      header={
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-700">Staff</p>
          <h1 className="font-serif text-2xl text-gold-700">Participants</h1>
        </div>
      }
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
          <AdminNav current="/admin/participants" className="mb-0" />
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
      <div className="grid gap-3">
        {paged.items.length ? (
          paged.items.map((row) => (
            <Link key={row.id} href={`/admin/participants/${row.id}`}>
              <Card className="hover:bg-parchment-100">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-xl">{row.full_name}</p>
                    <p className="text-sm text-ink-muted">
                      {row.email}
                      {row.committee_short_name ? ` · ${row.committee_short_name}` : ""}
                      {row.food_preference ? ` · ${row.food_preference}` : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      {STATUS_COPY[row.status] ?? row.status}
                      {row.paid ? " · Paid / in review" : " · Not paid"}
                    </p>
                  </div>
                  <span className="text-sm text-gold-700">Open</span>
                </div>
              </Card>
            </Link>
          ))
        ) : (
          <Card>
            <p className="text-ink-muted">No participants match this search.</p>
          </Card>
        )}
      </div>
    </AdminListShell>
  );
}
