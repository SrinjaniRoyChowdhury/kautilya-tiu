import type { Metadata } from "next";
import Link from "next/link";
import { AddParticipantModalButton } from "@/components/admin/add-participant-modal";
import { AdminFilters, AdminListShell, AdminPagination, AdminTable } from "@/components/admin/admin-filters";
import { Field, Select } from "@/components/ui/field";
import { Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import {
  getAdminParticipants,
  getAllEditionsAdmin,
  getCollectives,
  getCommitteesForEdition,
} from "@/lib/data";
import { formatDelegation } from "@/lib/format";
import { outstationSummary } from "@/lib/outstation";
import { adminListHref, matchesQuery, paginate, parsePage } from "@/lib/search";
import type { RegistrationStatus } from "@/types";

export const metadata: Metadata = { title: "Participants" };

const STATUS_COPY: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Awaiting allocation",
  PAYMENT_PENDING: "Awaiting pay",
  PAYMENT_VERIFIED: "Pay verified",
  PAYMENT_REJECTED: "Pay rejected",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

const STATUS_FILTERS: RegistrationStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "PAYMENT_PENDING",
  "PAYMENT_VERIFIED",
  "PAYMENT_REJECTED",
  "CONFIRMED",
];

const ALLOTMENT_FILTERS = [
  { id: "allocated", label: "Allocated" },
  { id: "awaiting", label: "Awaiting allocation" },
  { id: "with_portfolio", label: "Has portfolio" },
  { id: "no_portfolio", label: "No portfolio" },
] as const;

type AllotmentFilter = (typeof ALLOTMENT_FILTERS)[number]["id"];

function isAllotmentFilter(value: string | undefined): value is AllotmentFilter {
  return Boolean(value && ALLOTMENT_FILTERS.some((item) => item.id === value));
}

function isStatusFilter(value: string | undefined): value is RegistrationStatus {
  return Boolean(value && STATUS_FILTERS.includes(value as RegistrationStatus));
}

function isDelegationFilter(value: string | undefined): value is "SINGLE" | "DOUBLE" {
  return value === "SINGLE" || value === "DOUBLE";
}

export default async function AdminParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    edition?: string;
    page?: string;
    committee?: string;
    allotment?: string;
    collective?: string;
    delegation?: string;
    status?: string;
  }>;
}) {
  const {
    q = "",
    edition: editionId,
    page: pageRaw,
    committee: committeeRaw = "",
    allotment: allotmentRaw = "",
    collective: collectiveRaw = "",
    delegation: delegationRaw = "",
    status: statusRaw = "",
  } = await searchParams;

  const committee = committeeRaw.trim();
  const allotment = isAllotmentFilter(allotmentRaw) ? allotmentRaw : "";
  const collective = collectiveRaw.trim();
  const delegation = isDelegationFilter(delegationRaw) ? delegationRaw : "";
  const status = isStatusFilter(statusRaw) ? statusRaw : "";

  const [allowed, canEdit, editions, rows, collectives] = await Promise.all([
    hasPermission("registration.view"),
    hasPermission("registration.edit"),
    getAllEditionsAdmin(),
    getAdminParticipants(editionId || null),
    getCollectives(),
  ]);
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

  const defaultEditionId =
    editionId || editions.find((item) => item.is_public_active)?.id || editions[0]?.id || null;
  const committees = defaultEditionId ? await getCommitteesForEdition(defaultEditionId) : [];

  // When viewing all editions, still offer committee options seen in the loaded rows.
  const committeeOptions = (() => {
    if (editionId || !rows.length) {
      return committees.map((item) => ({ id: item.id, label: item.short_name }));
    }
    const byId = new Map<string, string>();
    for (const row of rows) {
      if (row.committee_id && row.committee_short_name) {
        byId.set(row.committee_id, row.committee_short_name);
      }
    }
    for (const item of committees) {
      byId.set(item.id, item.short_name);
    }
    return [...byId.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  })();

  const visible = rows.filter((row) => {
    if (committee && row.committee_id !== committee) return false;
    if (collective && row.collective_id !== collective) return false;
    if (delegation && (row.delegation_type ?? "SINGLE") !== delegation) return false;
    if (status && row.status !== status) return false;
    if (allotment === "allocated" && !row.committee_id) return false;
    if (allotment === "awaiting" && row.committee_id) return false;
    if (allotment === "with_portfolio" && !row.allocated_portfolio) return false;
    if (allotment === "no_portfolio" && row.allocated_portfolio) return false;
    return matchesQuery(
      q,
      row.full_name,
      row.email,
      row.committee_short_name,
      row.status,
      STATUS_COPY[row.status],
      row.collective_name,
      row.allocated_portfolio,
      row.display_code,
      outstationSummary(row),
      ...(row.preferences ?? []).flatMap((pref) => [
        pref.committee_short_name,
        pref.portfolio_1,
        pref.portfolio_2,
      ]),
    );
  });
  const paged = paginate(visible, parsePage(pageRaw));
  const query = {
    q,
    edition: editionId,
    committee: committee || undefined,
    allotment: allotment || undefined,
    collective: collective || undefined,
    delegation: delegation || undefined,
    status: status || undefined,
  };

  return (
    <AdminListShell
      header={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-xl text-gold-700">Participants</h1>
          <AddParticipantModalButton
            editions={editions}
            defaultEditionId={defaultEditionId}
            canEdit={canEdit}
          />
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
          {editions.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={adminListHref(
                  "/admin/participants",
                  {
                    q,
                    committee: committee || undefined,
                    allotment: allotment || undefined,
                    collective: collective || undefined,
                    delegation: delegation || undefined,
                    status: status || undefined,
                  },
                  1,
                )}
                className="text-sm text-gold-700 hover:underline"
              >
                All editions
              </Link>
              {editions.map((edition) => (
                <Link
                  key={edition.id}
                  href={adminListHref(
                    "/admin/participants",
                    {
                      q,
                      edition: edition.id,
                      committee: committee || undefined,
                      allotment: allotment || undefined,
                      collective: collective || undefined,
                      delegation: delegation || undefined,
                      status: status || undefined,
                    },
                    1,
                  )}
                  className="text-sm text-gold-700 hover:underline"
                >
                  {edition.name}
                </Link>
              ))}
            </div>
          ) : null}
          <AdminFilters action="/admin/participants" q={q}>
            {editionId ? <input type="hidden" name="edition" value={editionId} className="hidden" /> : null}
            <Field label="Committee" htmlFor="committee">
              <Select id="committee" name="committee" defaultValue={committee} className="h-9 min-w-[9rem] py-1.5">
                <option value="">All</option>
                {committeeOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Allotment" htmlFor="allotment">
              <Select id="allotment" name="allotment" defaultValue={allotment} className="h-9 min-w-[9rem] py-1.5">
                <option value="">All</option>
                {ALLOTMENT_FILTERS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Collective" htmlFor="collective">
              <Select id="collective" name="collective" defaultValue={collective} className="h-9 min-w-[9rem] py-1.5">
                <option value="">All</option>
                {collectives.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Delegation" htmlFor="delegation">
              <Select id="delegation" name="delegation" defaultValue={delegation} className="h-9 min-w-[8rem] py-1.5">
                <option value="">All</option>
                <option value="SINGLE">Single</option>
                <option value="DOUBLE">Double</option>
              </Select>
            </Field>
            <Field label="Status" htmlFor="status">
              <Select id="status" name="status" defaultValue={status} className="h-9 min-w-[9rem] py-1.5">
                <option value="">All</option>
                {STATUS_FILTERS.map((item) => (
                  <option key={item} value={item}>
                    {STATUS_COPY[item]}
                  </option>
                ))}
              </Select>
            </Field>
          </AdminFilters>
        </>
      }
    >
      {paged.items.length ? (
        <AdminTable columns={["Name", "Email", "Preferences", "Committee", "Allotment", "Collective", "Delegation", "Status", "QR", ""]}>
          {paged.items.map((row) => (
            <tr key={row.id} className="border-b border-gold-700/10 hover:bg-parchment-100">
              <td className="px-2 py-1.5 font-medium">
                {row.full_name}
                {row.is_outstation ? (
                  <span className="mt-0.5 block text-[11px] font-normal text-gold-800">Outstation</span>
                ) : null}
              </td>
              <td className="px-2 py-1.5 text-ink-muted">{row.email}</td>
              <td className="px-2 py-1.5 text-ink-muted">
                {(row.preferences ?? [])
                  .map((pref) => {
                    const portfolios = [pref.portfolio_1, pref.portfolio_2].filter(Boolean).join(" / ");
                    return `${pref.preference_order}. ${pref.committee_short_name ?? "Committee"}${portfolios ? ` (${portfolios})` : ""}`;
                  })
                  .join(" · ") || "—"}
              </td>
              <td className="px-2 py-1.5 text-ink-muted">{row.committee_short_name ?? "—"}</td>
              <td className="px-2 py-1.5 text-ink-muted">
                {formatDelegation(row.allocated_slr, row.allocated_portfolio) ?? ""}
              </td>
              <td className="px-2 py-1.5 text-ink-muted">{row.collective_name ?? "—"}</td>
              <td className="px-2 py-1.5 text-ink-muted">
                {row.delegation_type === "DOUBLE" ? "Double" : "Single"}
                {row.partner_email ? ` · ${row.partner_email}` : ""}
              </td>
              <td className="px-2 py-1.5 text-ink-muted">
                {STATUS_COPY[row.status] ?? row.status}
                {row.confirmed_free ? " · free" : row.paid ? " · paid" : ""}
              </td>
              <td className="px-2 py-1.5 font-mono text-sm tracking-wider">{row.display_code ?? ""}</td>
              <td className="px-2 py-1.5 text-right">
                <Link href={`/admin/participants/${row.id}`} className="text-gold-700 hover:underline">
                  {row.status === "SUBMITTED" ? "Allocate" : "Open"}
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <p className="text-sm text-ink-muted">No participants match these filters.</p>
      )}
    </AdminListShell>
  );
}
