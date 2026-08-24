import type { Metadata } from "next";
import Link from "next/link";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { formatDateRange } from "@/lib/format";
import { getPublicEditions } from "@/lib/data";

export const metadata: Metadata = { title: "Editions" };

export default async function EditionsPage() {
  const editions = await getPublicEditions();
  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Archive"
        title="Editions"
        description="Past and current conferences remain readable. Registration is only open on the public-active edition."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {editions.map((edition) => (
          <Link key={edition.id} href={`/editions/${edition.slug}`}>
            <Card className="h-full hover:bg-parchment-100">
              <p className="text-xs uppercase tracking-widest text-gold-700">{edition.year}</p>
              <h2 className="mt-1 font-serif text-2xl">{edition.name}</h2>
              {edition.theme ? <p className="mt-2 text-sm text-ink-muted">{edition.theme}</p> : null}
              <p className="mt-3 text-sm text-ink-muted">
                {formatDateRange(edition.start_date, edition.end_date)}
              </p>
              {edition.is_public_active ? (
                <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-gold-700">
                  Registration open
                </p>
              ) : null}
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  );
}
