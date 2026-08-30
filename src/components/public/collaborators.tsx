"use client";

import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/card";
import { MotionReveal, MotionStagger, MotionStaggerItem } from "@/components/motion/reveal";
import { type Collaborator } from "@/lib/collaborators";

function CollaboratorLogo({ collaborator }: { collaborator: Collaborator }) {
  const inner = collaborator.logoUrl ? (
    <Image
      src={collaborator.logoUrl}
      alt={collaborator.name}
      width={160}
      height={80}
      className="max-h-16 w-auto object-contain"
    />
  ) : (
    <span className="font-serif text-lg text-gold-700">{collaborator.name}</span>
  );

  return (
    <div className="flex h-full min-h-24 items-center justify-center rounded-sm bg-parchment-50/90 px-6 py-5">
      {inner}
    </div>
  );
}

export function CollaboratorsSection({ collaborators }: { collaborators: Collaborator[] }) {
  return (
    <section id="collaborators" className="border-t border-gold-700/20 bg-parchment-100/40 py-14">
      <Container>
        <MotionReveal className="mx-auto max-w-3xl text-center" delay={0.05}>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-700">
            Working together
          </p>
          <h2 className="mt-3 font-serif text-3xl text-gold-gradient sm:text-4xl">Collaborators</h2>
          <p className="mt-3 text-sm text-ink-muted">
            Societies, institutions, and teams that help shape the Kautilya experience.
          </p>
        </MotionReveal>

        {collaborators.length ? (
          <MotionStagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collaborators.map((collaborator) => (
              <MotionStaggerItem key={collaborator.id} as="div" className="frame-gold rounded-sm p-1">
                <CollaboratorLogo collaborator={collaborator} />
              </MotionStaggerItem>
            ))}
          </MotionStagger>
        ) : (
          <MotionStagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((slot) => (
              <MotionStaggerItem
                key={slot}
                as="div"
                className="frame-gold flex min-h-28 items-center justify-center rounded-sm border border-dashed border-gold-700/25 bg-parchment-50/60 px-6 py-8 text-center text-sm text-ink-muted"
              >
                Collaborator slot
              </MotionStaggerItem>
            ))}
          </MotionStagger>
        )}

        <MotionReveal className="mt-10 text-center text-sm text-ink-muted" delay={0.12}>
          Want to collaborate with us?{" "}
          <Link href="/contact" className="font-medium text-gold-700 hover:underline">
            Reach the secretariat
          </Link>
        </MotionReveal>
      </Container>
    </section>
  );
}
