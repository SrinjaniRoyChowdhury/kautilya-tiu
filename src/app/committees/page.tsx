import type { Metadata } from "next";
import { CommitteesPageView } from "@/components/public/committees-page-view";
import { Container } from "@/components/ui/card";
import { formatDateRange } from "@/lib/format";
import { getActiveEdition, getPublicCommittees } from "@/lib/data";

export const metadata: Metadata = { title: "Committees" };

export default async function CommitteesPage() {
  const edition = await getActiveEdition();
  const committees = edition ? await getPublicCommittees(edition.id) : [];
  const description = edition
    ? `${edition.theme ? `${edition.theme} · ` : ""}${formatDateRange(edition.start_date, edition.end_date)}`
    : "The public-active edition has not been published yet.";

  return (
    <Container className="py-12">
      <CommitteesPageView edition={edition} committees={committees} description={description} />
    </Container>
  );
}
