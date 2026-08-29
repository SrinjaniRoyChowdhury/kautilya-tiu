import Link from "next/link";
import { HiOutlineSpeakerphone } from "react-icons/hi";
import { HomeIntro } from "@/components/public/home-intro";
import { CommitteeCard, Hero, PlainCopy } from "@/components/public/marketing";
import { Card, Container } from "@/components/ui/card";
import { getActiveEdition, getAnnouncements, getPublicCommittees, getSiteSettings } from "@/lib/data";

export default async function HomePage() {
  const settings = await getSiteSettings();
  const edition = await getActiveEdition();
  const [committees, announcements] = edition
    ? await Promise.all([getPublicCommittees(edition.id), getAnnouncements(edition.id)])
    : [[], []];

  return (
    <>
      <HomeIntro />
      <Hero
        societyName={settings.society_name}
        tagline={settings.tagline}
        edition={edition}
        stats={(settings.hero_stats ?? []).filter(
          (stat) => stat.label.trim().toLowerCase() !== "editions hosted",
        )}
      />
      <Container className="pb-16">
        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="font-serif text-3xl text-gold-700">Committees</h2>
            <Link href="/committees" className="text-sm text-gold-700 hover:underline">
              All committees
            </Link>
          </div>
          {committees.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <p className="text-ink-muted">
                No published edition yet. An admin can create one from the portal.
              </p>
            </Card>
          )}
        </section>

        <section id="announcements" className="mt-14 scroll-mt-[calc(var(--site-header-height)+var(--announcement-ribbon-height)+1rem)]">
          <h2 className="mb-6 font-serif text-3xl text-gold-700">Announcements</h2>
          {announcements.length ? (
            <ul className="grid gap-4">
              {announcements.map((item) => (
                <li key={item.id}>
                  <Card>
                    <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold-700">
                      <HiOutlineSpeakerphone /> Notice
                    </p>
                    <h3 className="mt-2 font-serif text-2xl">{item.title}</h3>
                    <PlainCopy className="mt-2 text-sm" text={item.body_html} />
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">No announcements published.</p>
          )}
        </section>
      </Container>
    </>
  );
}
