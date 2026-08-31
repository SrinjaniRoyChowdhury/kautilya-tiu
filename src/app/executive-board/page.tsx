import type { Metadata } from "next";
import { ExecutiveBoardPageView } from "@/components/public/executive-board-page-view";
import { Container } from "@/components/ui/card";
import { formatDateRange } from "@/lib/format";
import { getActiveEdition, getPublicCommittees } from "@/lib/data";

export const metadata: Metadata = {
  title: "Executive Board",
  description: "Executive Board members and committee chairs for Kautilya MUN.",
};

export default async function ExecutiveBoardPage() {
  const edition = await getActiveEdition();
  const committees = edition ? await getPublicCommittees(edition.id) : [];
  const description = edition
    ? `${edition.theme ? `${edition.theme} · ` : ""}${formatDateRange(edition.start_date, edition.end_date)}`
    : "The public-active edition has not been published yet.";

  return (
    <Container className="py-12 sm:py-16">
      <ExecutiveBoardPageView
        edition={edition}
        description={description}
        committees={committees}
      />
    </Container>
  );
}
