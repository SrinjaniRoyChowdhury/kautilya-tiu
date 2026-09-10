import type { Metadata } from "next";
import { MotionPageHeader } from "@/components/motion/page-motion";
import { MotionReveal } from "@/components/motion/reveal";
import { SecretariatRoster } from "@/components/public/secretariat";
import { Card, Container } from "@/components/ui/card";
import { getActiveEdition, getTeamMembers } from "@/lib/data";
import { EVENT_EDITION, EVENT_NAME, resolvePublicRoster } from "@/lib/team";

export const metadata: Metadata = {
  title: "Team",
  description: `Secretariat of ${EVENT_NAME} ${EVENT_EDITION} — Kautilya MUN Nitisabha at Techno India University.`,
};

export default async function TeamPage() {
  const [edition, members] = await Promise.all([
    getActiveEdition(),
    getTeamMembers(),
  ]);

  if (edition?.hide_team) {
    return (
      <Container className="py-12 sm:py-16">
        <div className="grid gap-8">
          <MotionPageHeader
            eyebrow={edition?.name ?? "Secretariat"}
            title="Secretariat & Team"
            description={`The organizing team and secretariat behind ${EVENT_NAME} ${edition?.name ? edition.name : EVENT_EDITION}.`}
          />
          <MotionReveal delay={0.08}>
            <Card className="max-w-2xl">
              <p className="font-serif text-2xl text-gold-700 dark:text-gold-400">Team not yet disclosed</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                The secretariat and organizing team for this edition will be announced soon. Please check back later.
              </p>
            </Card>
          </MotionReveal>
        </div>
      </Container>
    );
  }

  const { core, usgs } = resolvePublicRoster(members);

  return (
    <Container className="py-12 sm:py-16">
      <SecretariatRoster core={core} usgs={usgs} />
    </Container>
  );
}
