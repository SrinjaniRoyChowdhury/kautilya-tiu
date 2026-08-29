"use client";

import { MotionPageHeader } from "@/components/motion/page-motion";
import { MotionReveal } from "@/components/motion/reveal";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import type { Edition } from "@/types";

export function ExecutiveBoardPageView({
  edition,
  description,
}: {
  edition: Edition | null;
  description: string;
}) {
  return (
    <>
      <MotionReveal immediate>
        <BackLink href="/committees" label="Back to committees" />
      </MotionReveal>
      <MotionPageHeader
        eyebrow={edition?.name ?? "Executive Board"}
        title="Executive Board"
        description={description}
      />
      <MotionReveal delay={0.08}>
        <Card className="max-w-2xl">
          <p className="font-serif text-2xl text-gold-700">EB not yet disclosed</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Committee executive boards will be announced here before the conference. Check back soon or
            browse individual committee pages for updates.
          </p>
        </Card>
      </MotionReveal>
    </>
  );
}
