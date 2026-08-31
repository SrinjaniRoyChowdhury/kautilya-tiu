"use client";

import Link from "next/link";
import { MotionPageHeader } from "@/components/motion/page-motion";
import { MotionReveal, MotionStagger, MotionStaggerItem } from "@/components/motion/reveal";
import { ExecutiveBoardCard } from "@/components/public/executive-board-card";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import type { Committee, Edition } from "@/types";

export function ExecutiveBoardPageView({
  edition,
  description,
  committees = [],
}: {
  edition: Edition | null;
  description: string;
  committees?: Committee[];
}) {
  const committeesWithEb = committees.filter(
    (c) => Array.isArray(c.eb_json) && c.eb_json.length > 0,
  );

  return (
    <div className="grid gap-12 sm:gap-16">
      <div>
        <MotionReveal immediate>
          <BackLink href="/committees" label="Back to committees" />
        </MotionReveal>
        <MotionPageHeader
          eyebrow={edition?.name ?? "Executive Board"}
          title="Executive Board"
          description={description}
        />
      </div>

      {committeesWithEb.length === 0 ? (
        <MotionReveal delay={0.08}>
          <Card className="max-w-2xl">
            <p className="font-serif text-2xl text-gold-700">EB not yet disclosed</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Committee executive boards will be announced here before the conference. Check back soon or
              browse individual committee pages for updates.
            </p>
          </Card>
        </MotionReveal>
      ) : (
        <div className="space-y-16">
          {committeesWithEb.map((committee) => (
            <MotionReveal key={committee.id} as="section" aria-labelledby={`eb-${committee.slug}`} delay={0.05}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gold-700/20 pb-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-sm border border-gold-700/30 bg-gold-700/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-widest text-gold-700 dark:text-gold-300">
                    {committee.short_name}
                  </span>
                  <h2 id={`eb-${committee.slug}`} className="font-serif text-2xl font-semibold text-ink sm:text-3xl dark:text-parchment-50">
                    {committee.name}
                  </h2>
                </div>
                <Link
                  href={`/committees/${committee.slug}`}
                  className="text-xs font-semibold uppercase tracking-wider text-gold-700 hover:underline dark:text-gold-400"
                >
                  View Committee &rarr;
                </Link>
              </div>

              <MotionStagger className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {committee.eb_json.map((member, index) => (
                  <MotionStaggerItem key={`${member.name}-${index}`}>
                    <ExecutiveBoardCard
                      member={member}
                      committeeShortName={committee.short_name}
                    />
                  </MotionStaggerItem>
                ))}
              </MotionStagger>
            </MotionReveal>
          ))}
        </div>
      )}
    </div>
  );
}
