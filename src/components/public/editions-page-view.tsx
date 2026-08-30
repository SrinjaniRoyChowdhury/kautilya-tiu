"use client";

import Link from "next/link";
import { MotionPageHeader } from "@/components/motion/page-motion";
import { MotionStagger, MotionStaggerItem } from "@/components/motion/reveal";
import { Card } from "@/components/ui/card";
import { formatDateRange } from "@/lib/format";
import type { Edition } from "@/types";

export function EditionsPageView({ editions }: { editions: Edition[] }) {
  return (
    <>
      <MotionPageHeader
        eyebrow="Archive"
        title="Editions"
        description="Past and current conferences remain readable. Registration is only open on the public-active edition."
      />
      <MotionStagger className="grid gap-4 sm:grid-cols-2">
        {editions.map((edition) => (
          <MotionStaggerItem key={edition.id} as="div">
            <Link href={`/editions/${edition.slug}`}>
              <Card className="h-full hover:bg-parchment-100">
                <p className="text-xs uppercase tracking-widest text-gold-700">{edition.year}</p>
                <h2 className="mt-1 font-serif text-2xl">{edition.name}</h2>
                {edition.theme ? <p className="mt-2 text-sm text-ink-muted">{edition.theme}</p> : null}
                <p className="mt-3 text-sm text-ink-muted">
                  {formatDateRange(edition.start_date, edition.end_date)}
                </p>
                {edition.is_public_active ? (
                  <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-gold-700">
                    Registration open
                  </p>
                ) : null}
              </Card>
            </Link>
          </MotionStaggerItem>
        ))}
      </MotionStagger>
    </>
  );
}
