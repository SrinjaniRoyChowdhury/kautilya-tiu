import { HomeIntro } from "@/components/public/home-intro";
import { Hero } from "@/components/public/marketing";
import { HomeSections } from "@/components/public/home-sections";
import { CollaboratorsSection } from "@/components/public/collaborators";
import { SponsorsSection } from "@/components/public/sponsors";
import { Container } from "@/components/ui/card";
import { mapCmsCollaborator } from "@/lib/collaborators";
import {
  getActiveEdition,
  getAnnouncements,
  getCollaborators,
  getPublicCommittees,
  getSiteSettings,
  getSponsors,
} from "@/lib/data";
import { mapCmsSponsor } from "@/lib/sponsors";

export default async function HomePage() {
  const [settings, edition] = await Promise.all([getSiteSettings(), getActiveEdition()]);
  const [committees, announcements, sponsors, collaborators] = await Promise.all([
    edition ? getPublicCommittees(edition.id) : Promise.resolve([]),
    edition ? getAnnouncements(edition.id) : Promise.resolve([]),
    getSponsors(),
    getCollaborators(),
  ]);

  return (
    <>
      {/* Preload while RSC streams so playback can start as soon as the overlay mounts. */}
      <link rel="preload" href="/intro.mp4" as="video" type="video/mp4" />
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
        <HomeSections committees={committees} announcements={announcements} />
      </Container>
      <CollaboratorsSection collaborators={collaborators.map(mapCmsCollaborator)} />
      <SponsorsSection sponsors={sponsors.map(mapCmsSponsor)} />
    </>
  );
}
