import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getAllEditionsAdmin } from "@/lib/data";
import { canExportKind, REPORT_KINDS, type ReportKind } from "@/lib/reports";

export const metadata: Metadata = { title: "Reports" };

const COPY: Record<ReportKind, { title: string; detail: string }> = {
  participants: {
    title: "Participants",
    detail: "Name, email, committee, registration status, food preference, fee.",
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
        description="CSV only — spreadsheets open it without a paid Excel library. Each download is checked on the server."
      />
      <AdminNav current="/admin/reports" />
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
    </Container>
  );
}
