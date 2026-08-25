import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { formatInrFromMinor, seatsRemaining } from "@/lib/format";
import { toPlainText } from "@/lib/sanitize";
import { seatsHeld } from "@/lib/registration";
import { getActiveEdition, getCommitteeBySlug } from "@/lib/data";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.toUpperCase() };
}

export default async function CommitteeDetailPage({ params }: Props) {
  const { slug } = await params;
  const edition = await getActiveEdition();
  if (!edition) notFound();
  const committee = await getCommitteeBySlug(edition.id, slug);
  if (!committee || committee.status === "HIDDEN") notFound();

  const remaining = seatsRemaining(
    committee.capacity,
    seatsHeld(committee.occupied_count, committee.confirmed_count),
  );

  return (
    <Container className="py-12">
      <PageHeader eyebrow={committee.short_name} title={committee.name} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <article>
          <p className="whitespace-pre-wrap text-ink-muted leading-7">
            {toPlainText(committee.description) || "A full briefing will be published with the study guide."}
          </p>
          {committee.rules_url ? (
            <p className="mt-4">
              <a href={committee.rules_url} className="text-gold-700 hover:underline">
                Rules of procedure
              </a>
            </p>
          ) : null}
          {committee.eb_json?.length ? (
            <section className="mt-8">
              <h2 className="font-serif text-2xl text-gold-700">Executive board</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {committee.eb_json.map((member) => (
                  <li key={`${member.name}-${member.title}`}>
                    <span className="font-medium">{member.name}</span>
                    <span className="text-ink-muted"> · {member.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {committee.portfolio_config?.length ? (
            <section className="mt-8">
              <h2 className="font-serif text-2xl text-gold-700">Portfolios</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {committee.portfolio_config.map((item) => (
                  <li
                    key={`${item.slr ?? item.name}-${item.name}`}
                    className="rounded-sm border border-gold-700/25 px-2 py-1 text-sm"
                  >
                    {item.slr ? `${item.slr}. ` : ""}
                    {item.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
        <Card className="h-fit space-y-3">
          <p className="text-sm text-ink-muted">Fee</p>
          <p className="font-serif text-3xl text-gold-700">
            {formatInrFromMinor(committee.fee_minor)}
          </p>
          <p className="text-sm text-ink-muted">
            {remaining} of {committee.capacity} delegations remaining
          </p>
          <p className="text-sm text-ink-muted">Status: {committee.status}</p>
          <Link
            href={`/dashboard/register?committee=${committee.slug}`}
            className="inline-flex h-11 items-center justify-center rounded-sm bg-gold-700 px-4 text-sm font-medium text-parchment-50"
          >
            Register
          </Link>
        </Card>
      </div>
    </Container>
  );
}
