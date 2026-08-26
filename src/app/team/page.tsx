import type { Metadata } from "next";
import { SecretariatRoster } from "@/components/public/secretariat";
import { Container } from "@/components/ui/card";
import { getTeamMembers } from "@/lib/data";
import { EVENT_EDITION, EVENT_NAME, resolvePublicRoster } from "@/lib/team";

export const metadata: Metadata = {
  title: "Team",
  description: `Secretariat of ${EVENT_NAME} ${EVENT_EDITION}, the annual Model United Nations conference of Techno India University.`,
};

export default async function TeamPage() {
  const members = await getTeamMembers();
  const { core, usgs } = resolvePublicRoster(members);

  return (
    <Container className="py-12 sm:py-16">
      <SecretariatRoster core={core} usgs={usgs} />
    </Container>
  );
}
