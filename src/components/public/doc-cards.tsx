"use client";

import { Card } from "@/components/ui/card";
import { MotionStagger, MotionStaggerItem } from "@/components/motion/reveal";
import { DOC_KINDS, DOC_LABELS, type DocKind } from "@/lib/docs";

export function ConferenceDocCards({
  published,
}: {
  published: Record<DocKind, boolean>;
}) {
  return (
    <MotionStagger className="grid gap-4 sm:grid-cols-2">
      {DOC_KINDS.map((kind) => (
        <MotionStaggerItem key={kind} as="div">
          <Card>
            <p className="font-serif text-2xl text-gold-700">{DOC_LABELS[kind]}</p>
            {published[kind] ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={`/api/docs/${kind}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center rounded-sm bg-gold-700 px-5 text-sm font-medium text-parchment-50 hover:bg-[#74541f]"
                >
                  Open
                </a>
                <a
                  href={`/api/docs/${kind}?download=1`}
                  className="inline-flex h-11 items-center justify-center rounded-sm border border-gold-700/50 bg-parchment-50/70 px-5 text-sm font-medium text-gold-700 hover:bg-parchment-200"
                >
                  Download
                </a>
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">This document is not published yet.</p>
            )}
          </Card>
        </MotionStaggerItem>
      ))}
    </MotionStagger>
  );
}
