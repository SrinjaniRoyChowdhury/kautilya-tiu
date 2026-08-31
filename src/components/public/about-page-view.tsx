"use client";

import { MotionPageHeader } from "@/components/motion/page-motion";
import { MotionReveal } from "@/components/motion/reveal";
import { PlainCopy } from "@/components/public/marketing";
import type { SiteSettings } from "@/types";

export function AboutPageView({ settings }: { settings: SiteSettings }) {
  return (
    <>
      <MotionPageHeader eyebrow="The society" title="About" description={settings.tagline ?? undefined} />
      <article className="grid gap-8 lg:grid-cols-2">
        <MotionReveal as="section" delay={0.05}>
          <h2 className="font-serif text-2xl text-gold-700">Who we are</h2>
          <PlainCopy
            className="mt-3"
            text={settings.about_html}
            fallback="About copy is managed in the CMS."
          />
        </MotionReveal>
        <MotionReveal as="section" delay={0.1}>
          <h2 className="font-serif text-2xl text-gold-700">Mission</h2>
          <PlainCopy
            className="mt-3"
            text={settings.mission_html}
            fallback="Mission copy is managed in the CMS."
          />
        </MotionReveal>
        <MotionReveal as="section" className="lg:col-span-2" delay={0.14}>
          <h2 className="font-serif text-2xl text-gold-700">History</h2>
          <PlainCopy
            className="mt-3"
            text={settings.history_html}
            fallback="History copy is managed in the CMS."
          />
        </MotionReveal>
      </article>
    </>
  );
}
