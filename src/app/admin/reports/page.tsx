import type { Metadata } from "next";
import Link from "next/link";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getAllEditionsAdmin, getCommitteesForEdition } from "@/lib/data";
import { canExportKind, REPORT_KINDS, type ReportKind } from "@/lib/reports";

export const metadata: Metadata = { title: "Reports" };

const COPY: Record<ReportKind, { title: string; detail: string }> = {
  participants: {
    title: "Participants",
    detail: "Name, email, committee, collective, registration status, food preference, fee.",
  },
  payments: {
    title: "Payments",
    detail: "Status, expected vs paid, payer, linked participants, verification time.",
  },
  attendance: {
    title: "Attendance",
    detail: "Check-in and check-out for every day, with scan method.",
  },
  food: {
    title: "Food",
    detail: "Each collected meal, delegate, and timestamp.",
  },
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const { edition: editionId } = await searchParams;
  const editions = await getAllEditionsAdmin();
  const edition =
    editions.find((item) => item.id === editionId) ??
    editions.find((item) => item.is_public_active) ??
    editions[0] ??
    null;

  const canParticipants = edition ? await canExportKind("participants", edition.id) : false;
  const committees = edition && canParticipants ? await getCommitteesForEdition(edition.id) : [];

  const allowed = await Promise.all(
    REPORT_KINDS.map(async (kind) => ({
      kind,
      ok: edition ? await canExportKind(kind, edition.id) : false,
    })),
  );
  const any = allowed.some((item) => item.ok);

  if (!any) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Reports"
          description="You need a report.export or a scoped report.* permission to download CSV."
        />
      </Container>
    );
  }

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Staff"
        title="Reports"
        description="CSV for operations lists, and Excel for each committee's SLR, portfolio, and delegate."
      />
      {editions.length > 1 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {editions.map((item) => (
            <Link
              key={item.id}
              href={`/admin/reports?edition=${item.id}`}
              className={
                item.id === edition?.id
                  ? "rounded-sm bg-gold-700 px-3 py-1.5 text-sm text-parchment-50"
                  : "rounded-sm border border-gold-700/25 px-3 py-1.5 text-sm text-gold-700"
              }
            >
              {item.name}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {allowed
          .filter((item) => item.ok)
          .map(({ kind }) => (
            <Card key={kind}>
              <p className="font-serif text-2xl text-gold-700">{COPY[kind].title}</p>
              <p className="mt-2 text-sm text-ink-muted">{COPY[kind].detail}</p>
              {edition ? (
                <a
                  href={`/admin/reports/${kind}?edition=${edition.id}`}
                  className="mt-4 inline-block text-sm text-gold-700 hover:underline"
                >
                  Download CSV
                </a>
              ) : null}
            </Card>
          ))}
      </div>
      {committees.length ? (
        <div className="mt-10">
          <h2 className="font-serif text-2xl text-gold-700">Committee Excel</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Each file has SLR number, portfolio, and the allocated delegate name.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {committees.map((committee) => (
              <Card key={committee.id}>
                <p className="font-serif text-2xl text-gold-700">{committee.short_name}</p>
                <p className="mt-1 text-sm text-ink-muted">{committee.name}</p>
                <p className="mt-2 text-sm text-ink-muted">{committee.portfolio_config.length} delegations</p>
                <a
                  href={`/admin/reports/committee/${committee.id}`}
                  className="mt-4 inline-block text-sm text-gold-700 hover:underline"
                >
                  Download Excel
                </a>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </Container>
  );
}
