"use client";

import Link from "next/link";
import { HiOutlineSpeakerphone } from "react-icons/hi";
import { CommitteeCard, PlainCopy } from "@/components/public/marketing";
import { MotionReveal, MotionStagger, MotionStaggerItem } from "@/components/motion/reveal";
import { Card } from "@/components/ui/card";
import type { Announcement, Committee } from "@/types";

export function HomeSections({
  committees,
  announcements,
}: {
  committees: Committee[];
  announcements: Announcement[];
}) {
  return (
    <>
      <MotionReveal as="section" delay={0.05}>
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-serif text-3xl text-gold-700">Committees</h2>
          <Link href="/committees" className="text-sm text-gold-700 hover:underline">
            All committees
          </Link>
        </div>
        {committees.length ? (
          <MotionStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {committees.map((committee) => (
              <MotionStaggerItem key={committee.id} as="div">
                <CommitteeCard committee={committee} href={`/committees/${committee.slug}`} />
              </MotionStaggerItem>
            ))}
          </MotionStagger>
        ) : (
          <Card>
            <p className="text-ink-muted">
              No published edition yet. An admin can create one from the portal.
            </p>
          </Card>
        )}
      </MotionReveal>

      <MotionReveal
        as="section"
        id="announcements"
        className="mt-14 scroll-mt-[calc(var(--site-header-height)+var(--announcement-ribbon-height)+1rem)]"
        delay={0.08}
      >
        <h2 className="mb-6 font-serif text-3xl text-gold-700">Announcements</h2>
        {announcements.length ? (
          <MotionStagger as="ul" className="grid gap-4">
            {announcements.map((item) => (
              <MotionStaggerItem key={item.id} as="li">
                <Card>
                  <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold-700">
                    <HiOutlineSpeakerphone /> Notice
                  </p>
                  <h3 className="mt-2 font-serif text-2xl">{item.title}</h3>
                  <PlainCopy className="mt-2 text-sm" text={item.body_html} />
                </Card>
              </MotionStaggerItem>
            ))}
          </MotionStagger>
        ) : (
          <p className="text-ink-muted">No announcements published.</p>
        )}
      </MotionReveal>
    </>
  );
}
