import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilters, AdminListShell, AdminPagination } from "@/components/admin/admin-filters";
import { HelpDeskView } from "@/components/admin/help-desk-view";
import { Container, PageHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { isStaffUser } from "@/lib/auth";
import { getHelpDeskQueries } from "@/lib/data";
import { adminListHref, inDateRange, matchesQuery, paginate, parsePage } from "@/lib/search";
import { HELP_DESK_TYPES } from "@/types";

export const metadata: Metadata = { title: "Help Desk | Admin" };

export default async function AdminHelpDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; from?: string; to?: string; page?: string }>;
}) {
  const staff = await isStaffUser();
  if (!staff) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Help Desk"
          description="You need staff permissions to view secretariat queries."
        />
      </Container>
    );
  }

  const { q = "", type = "", from = "", to = "", page: pageRaw } = await searchParams;

  // Load all queries so we can compute category counts and apply in-memory search/date filters
  const allQueries = await getHelpDeskQueries({ limit: 1000 });

  const delegateCount = allQueries.filter((row) => row.type === "Delegate Queries").length;
  const partnershipCount = allQueries.filter((row) => row.type === "Partnership").length;
  const pressFacultyCount = allQueries.filter((row) => row.type === "Press and Faculty").length;
  const pendingCount = allQueries.filter((row) => row.status === "PENDING").length;

  const visible = allQueries.filter((row) => {
    if (type && row.type !== type) return false;
    if (!inDateRange(row.created_at, from, to)) return false;
    return matchesQuery(q, row.name, row.email, row.phone, row.subject, row.description);
  });

  const paged = paginate(visible, parsePage(pageRaw));
  const queryParams = { q, type, from, to };

  return (
    <AdminListShell
      header={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl text-gold-700">Help Desk</h1>
            <p className="text-xs text-ink-muted mt-0.5">
              Queries submitted through the contact desk · {allQueries.length} total ({pendingCount} pending)
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href={adminListHref("/admin/help-desk", { ...queryParams, type: undefined }, 1)}
              className={`rounded-sm px-2.5 py-1 transition-colors ${
                !type
                  ? "bg-gold-700 text-parchment-50 font-medium"
                  : "border border-gold-700/25 text-gold-700 hover:bg-parchment-200"
              }`}
            >
              All ({allQueries.length})
            </Link>
            <Link
              href={adminListHref("/admin/help-desk", { ...queryParams, type: "Delegate Queries" }, 1)}
              className={`rounded-sm px-2.5 py-1 transition-colors ${
                type === "Delegate Queries"
                  ? "bg-blue-700 text-parchment-50 font-medium"
                  : "border border-blue-700/30 text-blue-800 hover:bg-blue-50"
              }`}
            >
              Delegates ({delegateCount})
            </Link>
            <Link
              href={adminListHref("/admin/help-desk", { ...queryParams, type: "Partnership" }, 1)}
              className={`rounded-sm px-2.5 py-1 transition-colors ${
                type === "Partnership"
                  ? "bg-amber-700 text-parchment-50 font-medium"
                  : "border border-amber-700/30 text-amber-800 hover:bg-amber-50"
              }`}
            >
              Partnerships ({partnershipCount})
            </Link>
            <Link
              href={adminListHref("/admin/help-desk", { ...queryParams, type: "Press and Faculty" }, 1)}
              className={`rounded-sm px-2.5 py-1 transition-colors ${
                type === "Press and Faculty"
                  ? "bg-purple-700 text-parchment-50 font-medium"
                  : "border border-purple-700/30 text-purple-800 hover:bg-purple-50"
              }`}
            >
              Press & Faculty ({pressFacultyCount})
            </Link>
          </div>
        </div>
      }
      toolbar={
        <AdminFilters action="/admin/help-desk" q={q} qPlaceholder="Search name, email, phone, subject...">
          <Field label="Type" htmlFor="type">
            <Select id="type" name="type" defaultValue={type}>
              <option value="">All types</option>
              {HELP_DESK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
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
      footer={
        <AdminPagination
          page={paged.page}
          pageCount={paged.pageCount}
          total={paged.total}
          from={paged.from}
          to={paged.to}
          makeHref={(next) => adminListHref("/admin/help-desk", queryParams, next)}
        />
      }
    >
      <HelpDeskView queries={paged.items} />
    </AdminListShell>
  );
}
