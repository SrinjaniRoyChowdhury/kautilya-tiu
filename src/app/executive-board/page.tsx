import type { Metadata } from "next";
import { ExecutiveBoardPageView } from "@/components/public/executive-board-page-view";
import { Container } from "@/components/ui/card";
import { formatDateRange } from "@/lib/format";
import { getActiveEdition } from "@/lib/data";

export const metadata: Metadata = { title: "Executive Board" };

export default async function ExecutiveBoardPage() {
  const edition = await getActiveEdition();
  const description = edition
    ? `${edition.theme ? `${edition.theme} · ` : ""}${formatDateRange(edition.start_date, edition.end_date)}`
    : "The public-active edition has not been published yet.";

  return (
    <Container className="py-12">
      <ExecutiveBoardPageView edition={edition} description={description} />
    </Container>
  );
}
