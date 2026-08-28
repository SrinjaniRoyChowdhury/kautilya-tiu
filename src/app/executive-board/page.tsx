import type { Metadata } from "next";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { BackLink } from "@/components/ui/back-link";
import { formatDateRange } from "@/lib/format";
import { getActiveEdition } from "@/lib/data";

export const metadata: Metadata = { title: "Executive Board" };

export default async function ExecutiveBoardPage() {
  const edition = await getActiveEdition();

  return (
    <Container className="py-12">
      <BackLink href="/committees" label="Back to committees" />
      <PageHeader
        eyebrow={edition?.name ?? "Executive Board"}
        title="Executive Board"
        description={
          edition
            ? `${edition.theme ? `${edition.theme} · ` : ""}${formatDateRange(edition.start_date, edition.end_date)}`
            : "The public-active edition has not been published yet."
        }
      />
      <Card className="max-w-2xl">
        <p className="font-serif text-2xl text-gold-700">EB not yet disclosed</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Committee executive boards will be announced here before the conference. Check back soon or
          browse individual committee pages for updates.
        </p>
      </Card>
    </Container>
  );
}
