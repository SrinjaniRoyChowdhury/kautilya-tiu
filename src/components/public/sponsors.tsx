"use client";

import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/card";
import { MotionReveal, MotionStagger, MotionStaggerItem } from "@/components/motion/reveal";
import { SPONSOR_TIER_LABELS, type Sponsor, type SponsorTier } from "@/lib/sponsors";

const TIER_ORDER: SponsorTier[] = ["title", "gold", "silver", "partner"];

function SponsorLogo({ sponsor }: { sponsor: Sponsor }) {
  const inner = sponsor.logoUrl ? (
    <Image
      src={sponsor.logoUrl}
      alt={sponsor.name}
      width={160}
      height={80}
      className="max-h-16 w-auto object-contain"
    />
  ) : (
    <span className="font-serif text-lg text-gold-700">{sponsor.name}</span>
  );

  return (
    <div className="flex h-full min-h-24 items-center justify-center rounded-sm bg-parchment-50/90 px-6 py-5">
      {inner}
    </div>
  );
}

function SponsorTierGroup({ tier, sponsors }: { tier: SponsorTier; sponsors: Sponsor[] }) {
  if (!sponsors.length) return null;

  const isTitle = tier === "title";

  return (
    <MotionReveal delay={0.06}>
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-gold-700">
        {SPONSOR_TIER_LABELS[tier]}
      </p>
      <MotionStagger className={isTitle ? "mx-auto max-w-md" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
        {sponsors.map((sponsor) => (
          <MotionStaggerItem key={sponsor.id} as="div" className="frame-gold rounded-sm p-1">
            <SponsorLogo sponsor={sponsor} />
          </MotionStaggerItem>
        ))}
      </MotionStagger>
    </MotionReveal>
  );
}

export function SponsorsSection({ sponsors }: { sponsors: Sponsor[] }) {
  const grouped = TIER_ORDER.map((tier) => ({
    tier,
    sponsors: sponsors.filter((sponsor) => sponsor.tier === tier),
  })).filter((group) => group.sponsors.length > 0);

  return (
    <section id="sponsors" className="border-t border-gold-700/20 bg-parchment-100/40 py-14">
      <Container>
        <MotionReveal className="mx-auto max-w-3xl text-center" delay={0.05}>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-700">
            With gratitude
          </p>
          <h2 className="mt-3 font-serif text-3xl text-gold-gradient sm:text-4xl">Our sponsors</h2>
          <p className="mt-3 text-sm text-ink-muted">
            Our partners help bring diplomacy, debate, and statecraft to life on campus.
          </p>
        </MotionReveal>

        {grouped.length ? (
          <div className="mt-10 space-y-10">
            {grouped.map(({ tier, sponsors: tierSponsors }) => (
              <SponsorTierGroup key={tier} tier={tier} sponsors={tierSponsors} />
            ))}
          </div>
        ) : (
          <MotionStagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((slot) => (
              <MotionStaggerItem
                key={slot}
                as="div"
                className="frame-gold flex min-h-28 items-center justify-center rounded-sm border border-dashed border-gold-700/25 bg-parchment-50/60 px-6 py-8 text-center text-sm text-ink-muted"
              >
                Sponsor slot
              </MotionStaggerItem>
            ))}
          </MotionStagger>
        )}

        <MotionReveal className="mt-10 text-center text-sm text-ink-muted" delay={0.12}>
          Interested in partnering with us?{" "}
          <Link href="/contact" className="font-medium text-gold-700 hover:underline">
            Reach the secretariat
          </Link>
        </MotionReveal>
      </Container>
    </section>
  );
}
