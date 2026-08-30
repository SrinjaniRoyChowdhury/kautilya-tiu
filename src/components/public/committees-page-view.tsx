"use client";

import { CommitteeCard } from "@/components/public/marketing";
import { MotionPageHeader } from "@/components/motion/page-motion";
import { MotionReveal, MotionStagger, MotionStaggerItem } from "@/components/motion/reveal";
import { Card } from "@/components/ui/card";
import type { Committee, Edition } from "@/types";

export function CommitteesPageView({
  edition,
  committees,
  description,
}: {
  edition: Edition | null;
  committees: Committee[];
  description: string;
}) {
  return (
    <>
      <MotionPageHeader
        eyebrow={edition?.name ?? "Committees"}
        title="Committees"
        description={description}
      />
      {committees.length ? (
        <MotionStagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {committees.map((committee) => (
            <MotionStaggerItem key={committee.id} as="div">
              <CommitteeCard committee={committee} href={`/committees/${committee.slug}`} />
            </MotionStaggerItem>
          ))}
        </MotionStagger>
      ) : (
        <MotionReveal delay={0.08}>
          <Card>
            <p className="text-ink-muted">No committees are listed for the current edition.</p>
          </Card>
        </MotionReveal>
      )}
    </>
  );
}
