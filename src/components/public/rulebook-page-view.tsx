"use client";

import { MotionPageHeader } from "@/components/motion/page-motion";
import { MotionReveal } from "@/components/motion/reveal";
import { ConferenceDocCards } from "@/components/public/doc-cards";
import { bothDocsPublished, type DocLinks } from "@/lib/docs";

export function RulebookPageView({ links }: { links: DocLinks }) {
  return (
    <>
      <MotionPageHeader
        eyebrow="Procedure"
        title="Rulebook and guidelines"
        description="Open both documents before you register. The secretariat publishes the links here."
      />
      <ConferenceDocCards links={links} />
      {!bothDocsPublished(links) ? (
        <MotionReveal delay={0.1}>
          <p className="mt-6 text-sm text-ink-muted">Links will appear here once the secretariat saves them in CMS.</p>
        </MotionReveal>
      ) : null}
    </>
  );
}
