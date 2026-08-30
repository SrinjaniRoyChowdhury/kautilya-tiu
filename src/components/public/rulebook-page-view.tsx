"use client";

import { ConferenceDocCards } from "@/components/public/doc-cards";
import { MotionPageHeader } from "@/components/motion/page-motion";
import { MotionReveal } from "@/components/motion/reveal";
import { DOC_KINDS, type DocKind } from "@/lib/docs";

export function RulebookPageView({
  published,
}: {
  published: Record<DocKind, boolean>;
}) {
  return (
    <>
      <MotionPageHeader
        eyebrow="Procedure"
        title="Rulebook and guidelines"
        description="Open or download both documents before you register. The secretariat publishes PDFs here; only admins can replace them."
      />
      <ConferenceDocCards published={published} />
      {DOC_KINDS.every((kind) => !published[kind]) ? (
        <MotionReveal delay={0.1}>
          <p className="mt-6 text-sm text-ink-muted">No files uploaded yet.</p>
        </MotionReveal>
      ) : null}
    </>
  );
}
