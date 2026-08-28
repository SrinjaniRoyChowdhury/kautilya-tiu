import type { Metadata } from "next";
import { CommitteeCard } from "@/components/public/marketing";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { formatDateRange } from "@/lib/format";
import { getActiveEdition, getPublicCommittees } from "@/lib/data";

export const metadata: Metadata = { title: "Committees" };

export default async function CommitteesPage() {
  const edition = await getActiveEdition();
  const committees = edition ? await getPublicCommittees(edition.id) : [];

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow={edition?.name ?? "Committees"}
        title="Committees"
        description={
          edition
            ? `${edition.theme ? `${edition.theme} · ` : ""}${formatDateRange(edition.start_date, edition.end_date)}`
            : "The public-active edition has not been published yet."
        }
      />
      {committees.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {committees.map((committee) => (
            <CommitteeCard
              key={committee.id}
              committee={committee}
              href={`/committees/${committee.slug}`}
            />
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-ink-muted">No committees are listed for the current edition.</p>
        </Card>
      )}
    </Container>
  );
}
