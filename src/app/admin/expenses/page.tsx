import type { Metadata } from "next";
import Link from "next/link";
import { CreateExpenseModalButton, ExpenseTable } from "@/components/admin/expense-forms";
import { AdminFilters, AdminListShell, AdminPagination } from "@/components/admin/admin-filters";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getAllEditionsAdmin, getEditionExpenseTotal, getEditionExpenses } from "@/lib/data";
import { getDashboardKpis } from "@/lib/analytics";
import { formatInrFromMinor } from "@/lib/format";
import { adminListHref, matchesQuery, paginate, parsePage } from "@/lib/search";

export const metadata: Metadata = { title: "Expenses" };

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string; q?: string; page?: string }>;
}) {
  const { edition: editionId, q = "", page: pageRaw } = await searchParams;
  const canView = await hasPermission("payment.view");
  const canEdit = await hasPermission("edition.manage");
  if (!canView && !canEdit) {
    return (
      <Container className="py-12">
        <PageHeader eyebrow="Staff" title="Expenses" description="You need payment.view or edition.manage." />
      </Container>
    );
  }

  const editions = await getAllEditionsAdmin();
  const edition =
    editions.find((item) => item.id === editionId) ??
    editions.find((item) => item.is_public_active) ??
    editions[0] ??
    null;
  if (!edition) {
    return (
      <Container className="py-12">
        <PageHeader title="Expenses" description="Create an edition first." />
      </Container>
    );
  }

  const [rows, total, kpis] = await Promise.all([
    getEditionExpenses(edition.id),
    getEditionExpenseTotal(edition.id),
    getDashboardKpis(edition.id, {
      registration: false,
      payment: true,
      attendance: false,
      food: false,
    }),
  ]);
  const revenue = kpis.payment?.paidVerifiedMinor ?? 0;
  const visible = rows.filter((row) => matchesQuery(q, row.title, row.category, row.notes));
  const paged = paginate(visible, parsePage(pageRaw));
  const query = { edition: edition.id, q };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Container className="shrink-0 py-6">
        <PageHeader
          title="Expenses"
          description={`${edition.name}. Revenue is verified payments. Balance is revenue minus expenses.`}
        />
        {editions.length > 1 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {editions.map((item) => (
              <Link
                key={item.id}
                href={`/admin/expenses?edition=${item.id}`}
                className={
                  item.id === edition.id
                    ? "rounded-sm bg-gold-700 px-2.5 py-1 text-sm text-parchment-50"
                    : "rounded-sm border border-gold-700/25 px-2.5 py-1 text-sm text-gold-700"
                }
              >
                {item.name}
              </Link>
            ))}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-xs uppercase tracking-widest text-gold-700">Revenue</p>
            <p className="mt-2 font-serif text-2xl text-gold-700">{formatInrFromMinor(revenue)}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-widest text-gold-700">Expenses</p>
            <p className="mt-2 font-serif text-2xl text-gold-700">{formatInrFromMinor(total)}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-widest text-gold-700">Balance</p>
            <p className="mt-2 font-serif text-2xl text-gold-700">{formatInrFromMinor(revenue - total)}</p>
          </Card>
        </div>
      </Container>
      <AdminListShell
        header={<h2 className="font-serif text-lg text-gold-700">Ledger</h2>}
        toolbar={
          <>
            {canEdit ? <CreateExpenseModalButton editionId={edition.id} /> : null}
            <AdminFilters action="/admin/expenses" q={q} qPlaceholder="Search title or category">
              <input type="hidden" name="edition" value={edition.id} />
            </AdminFilters>
          </>
        }
        footer={
          <AdminPagination
            page={paged.page}
            pageCount={paged.pageCount}
            total={paged.total}
            from={paged.from}
            to={paged.to}
            makeHref={(next) => adminListHref("/admin/expenses", query, next)}
          />
        }
      >
        <ExpenseTable rows={paged.items} canEdit={canEdit} />
      </AdminListShell>
    </div>
  );
}
