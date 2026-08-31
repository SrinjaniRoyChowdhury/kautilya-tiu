"use client";

import Link from "next/link";
import { useState } from "react";
import { HiArrowRight } from "react-icons/hi";
import { BrandLogo } from "@/components/brand/logo";
import { CommitteeFeeBlock } from "@/components/public/committee-fees";
import SpecularButton from "@/components/SpecularButton";
import { MotionReveal, MotionStagger, MotionStaggerItem } from "@/components/motion/reveal";
import { COMMITTEE_CARD_BACKGROUND_FALLBACK } from "@/lib/committee-card-background";
import { cn } from "@/lib/format";
import { formatDateRange, seatsRemaining } from "@/lib/format";
import { seatsHeld } from "@/lib/registration";
import { toPlainText } from "@/lib/sanitize";
import { PRESENTER_LINE } from "@/lib/team";
import type { Committee, Edition, HeroStat } from "@/types";

export function Hero({
  societyName,
  tagline,
  edition,
  stats,
}: {
  societyName: string;
  tagline: string | null;
  edition: Edition | null;
  stats: HeroStat[];
}) {
  return (
    <MotionReveal as="section" className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24" immediate>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-10">
          <BrandLogo
            src="/nitisabhaLogo.png"
            className="h-28 w-28 shrink-0 sm:h-40 sm:w-40"
            sizes="(max-width: 640px) 112px, 160px"
            priority
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-700">
              {PRESENTER_LINE}
            </p>
            <h1 className="mt-4 max-w-3xl font-serif text-5xl font-semibold leading-tight text-gold-gradient sm:text-7xl">
              {societyName}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-muted">
              {tagline ?? "Strategy. Diplomacy. Statecraft."}
            </p>
            {edition ? (
              <p className="mt-4 text-sm text-ink">
                {edition.name}
                {edition.theme ? ` · ${edition.theme}` : ""} ·{" "}
                {formatDateRange(edition.start_date, edition.end_date)}
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/dashboard/register"
                className="inline-flex h-12 items-center gap-2 rounded-sm bg-gold-700 px-6 text-sm font-medium text-parchment-50"
              >
                Register as a delegate <HiArrowRight />
              </Link>
              <SpecularButton
                href="/committees"
                size="md"
                radius={4}
                tint="#fffdf7"
                tintOpacity={0.7}
                blur={4}
                textColor="#8c6828"
                lineColor="#d4af62"
                baseColor="#8c6828"
                intensity={1.1}
                autoAnimate
                className="h-12 text-sm"
              >
                View committees
              </SpecularButton>
            </div>
          </div>
        </div>
        {stats.length ? (
          <MotionStagger as="dl" className="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-gold-700/20 pt-8">
            {stats.map((stat) => (
              <MotionStaggerItem key={stat.label} as="div">
                <dt className="text-xs uppercase tracking-widest text-ink-muted">{stat.label}</dt>
                <dd className="mt-1 font-serif text-3xl text-gold-700">{stat.value}</dd>
              </MotionStaggerItem>
            ))}
          </MotionStagger>
        ) : null}
      </div>
    </MotionReveal>
  );
}

export function CommitteeCard({
  committee,
  href,
  flip = false,
}: {
  committee: Committee;
  href: string;
  flip?: boolean;
}) {
  if (flip) {
    return <CommitteeFlipCard committee={committee} href={href} />;
  }
  return <CommitteeFlatCard committee={committee} href={href} />;
}

function committeeAvailability(committee: Committee) {
  const remaining = seatsRemaining(
    committee.capacity,
    seatsHeld(committee.occupied_count, committee.confirmed_count),
  );
  const full = remaining <= 0 && committee.status === "OPEN";
  const availabilityLabel =
    committee.status === "CLOSED" || full
      ? "Waitlist / closed"
      : `${remaining} of ${committee.capacity} delegations remaining`;
  return { remaining, full, availabilityLabel };
}

function CommitteeFlatCard({ committee, href }: { committee: Committee; href: string }) {
  const { availabilityLabel } = committeeAvailability(committee);
  return (
    <Link
      href={href}
      className="group frame-gold relative flex h-full min-h-[14rem] flex-col overflow-hidden rounded-sm bg-[#fff1d0] p-5 transition hover:brightness-[0.98] hover:shadow-md"
    >
      {committee.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={committee.logo_url}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-4 -bottom-2 h-36 w-36 object-contain opacity-[0.12] transition group-hover:opacity-[0.16] sm:h-40 sm:w-40"
        />
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-4 font-serif text-7xl font-bold uppercase tracking-tighter text-gold-700/10 sm:text-8xl"
        >
          {committee.short_name.slice(0, 4)}
        </div>
      )}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-700">
          {committee.short_name}
        </p>
        <CommitteeFeeBlock committee={committee} />
      </div>
      <h3 className="relative z-10 mt-3 font-serif text-2xl leading-snug text-ink">{committee.name}</h3>
      <p className="relative z-10 mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-muted">
        {committee.description || "Committee briefing will be published with the study guide."}
      </p>
      <div className="relative z-10 mt-5 flex items-center justify-between border-t border-gold-700/15 pt-4 text-xs text-ink-muted">
        <span>{availabilityLabel}</span>
        <span className="rounded-sm border border-gold-700/20 px-2 py-0.5 font-medium uppercase tracking-wide">
          {committee.status}
        </span>
      </div>
    </Link>
  );
}

function CommitteeFlipCard({ committee, href }: { committee: Committee; href: string }) {
  const [flipped, setFlipped] = useState(false);
  const { availabilityLabel } = committeeAvailability(committee);
  const backgroundUrl = committee.card_background_url || COMMITTEE_CARD_BACKGROUND_FALLBACK;

  return (
    <div className="committee-flip-scene aspect-square w-full">
      <div
        className={cn("committee-flip-inner relative h-full w-full", flipped && "is-flipped")}
      >
        <button
          type="button"
          aria-expanded={flipped}
          aria-label={`Show details for ${committee.name}`}
          onClick={() => setFlipped(true)}
          className="committee-flip-face committee-flip-front frame-gold absolute inset-0 overflow-hidden rounded-sm text-left"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1208]/88 via-[#1a1208]/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 p-5">
            <div className="flex items-end justify-between gap-3">
              <p className="text-xs leading-relaxed text-parchment-100/90">{availabilityLabel}</p>
              <span className="shrink-0 rounded-sm border border-gold-400/35 bg-[#fff1d0]/95 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-ink">
                {committee.status}
              </span>
            </div>
          </div>
        </button>

        <div className="committee-flip-face committee-flip-back frame-gold absolute inset-0 flex flex-col overflow-hidden rounded-sm bg-[#fff1d0] p-5">
          {committee.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={committee.logo_url}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -right-4 -bottom-2 h-28 w-28 object-contain opacity-[0.12] sm:h-32 sm:w-32"
            />
          ) : (
            <div
              aria-hidden
              className="pointer-events-none absolute -right-2 -bottom-4 font-serif text-6xl font-bold uppercase tracking-tighter text-gold-700/10 sm:text-7xl"
            >
              {committee.short_name.slice(0, 4)}
            </div>
          )}
          <div className="relative z-10 flex items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-700">
              {committee.short_name}
            </p>
            <CommitteeFeeBlock committee={committee} />
          </div>
          <h3 className="relative z-10 mt-3 font-serif text-xl leading-snug text-ink sm:text-2xl">
            {committee.name}
          </h3>
          <p className="relative z-10 mt-3 line-clamp-4 flex-1 text-sm leading-relaxed text-ink-muted">
            {committee.description || "Committee briefing will be published with the study guide."}
          </p>
          <div className="relative z-10 mt-4 flex items-center justify-between gap-3 border-t border-gold-700/15 pt-3 text-xs text-ink-muted">
            <button
              type="button"
              onClick={() => setFlipped(false)}
              className="font-medium text-gold-700 hover:underline"
            >
              Flip back
            </button>
            <Link
              href={href}
              className="rounded-sm border border-gold-700/20 px-2 py-0.5 font-medium uppercase tracking-wide text-ink transition hover:border-gold-700/40 hover:bg-parchment-100"
            >
              {committee.status}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlainCopy({
  text,
  fallback,
  className,
}: {
  text?: string | null;
  fallback?: string;
  className?: string;
}) {
  const value = toPlainText(text) || fallback || "";
  if (!value) return null;
  return <p className={cn("whitespace-pre-wrap leading-7 text-ink-muted", className)}>{value}</p>;
}
