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
  const settings = await getSiteSettings();
  const edition = await getActiveEdition();
  const [committees, announcements, sponsors, collaborators] = edition
    ? await Promise.all([
        getPublicCommittees(edition.id),
        getAnnouncements(edition.id),
        getSponsors(),
        getCollaborators(),
      ])
    : [[], [], await getSponsors(), await getCollaborators()];

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
        <HomeSections committees={committees} announcements={announcements} />
      </Container>
      <CollaboratorsSection collaborators={collaborators.map(mapCmsCollaborator)} />
      <SponsorsSection sponsors={sponsors.map(mapCmsSponsor)} />
    </>
  );
}
