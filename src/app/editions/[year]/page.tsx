import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommitteeCard } from "@/components/public/marketing";
import { Container, PageHeader } from "@/components/ui/card";
import { formatDateRange } from "@/lib/format";
import { getEditionBySlug, getPublicCommittees } from "@/lib/data";

type Props = { params: Promise<{ year: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year } = await params;
  return { title: `Edition ${year}` };
}

export default async function EditionDetailPage({ params }: Props) {
  const { year } = await params;
  const edition = await getEditionBySlug(year);
  if (!edition) notFound();
  const committees = await getPublicCommittees(edition.id);

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow={`Edition ${edition.year}`}
        title={edition.name}
        description={`${edition.theme ? `${edition.theme} · ` : ""}${formatDateRange(edition.start_date, edition.end_date)}`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {committees.map((committee) => (
          <CommitteeCard
            key={committee.id}
            committee={committee}
            href={edition.is_public_active ? `/committees/${committee.slug}` : `/editions/${edition.slug}`}
          />
        ))}
      </div>
    </Container>
  );
}
