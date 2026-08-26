import Link from "next/link";
import { HiArrowRight } from "react-icons/hi";
import { BrandLogo } from "@/components/brand/logo";
import { cn } from "@/lib/format";
import { formatDateRange, formatInrFromMinor, seatsRemaining } from "@/lib/format";
import { seatsHeld } from "@/lib/registration";
import { toPlainText } from "@/lib/sanitize";
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
    <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-10">
          <BrandLogo
            className="h-28 w-28 shrink-0 sm:h-40 sm:w-40"
            sizes="(max-width: 640px) 112px, 160px"
            priority
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-700">
              College Model United Nations
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
              <Link
                href="/committees"
                className="inline-flex h-12 items-center rounded-sm border border-gold-700/40 px-6 text-sm font-medium text-gold-700"
              >
                View committees
              </Link>
            </div>
          </div>
        </div>
        {stats.length ? (
          <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-gold-700/20 pt-8">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs uppercase tracking-widest text-ink-muted">{stat.label}</dt>
                <dd className="mt-1 font-serif text-3xl text-gold-700">{stat.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

export function CommitteeCard({
  committee,
  href,
}: {
  committee: Committee;
  href: string;
}) {
  const remaining = seatsRemaining(
    committee.capacity,
    seatsHeld(committee.occupied_count, committee.confirmed_count),
  );
  const full = remaining <= 0 && committee.status === "OPEN";
  return (
    <Link
      href={href}
      className="frame-gold flex h-full flex-col rounded-sm bg-parchment-50/90 p-5 transition hover:bg-parchment-100"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-700">
          {committee.short_name}
        </p>
          <p className="text-sm text-ink-muted">{formatInrFromMinor(committee.fee_minor)}</p>
          {committee.allows_double_del ? (
            <p className="text-xs text-ink-muted">
              Double {formatInrFromMinor(committee.double_fee_minor ?? committee.fee_minor)}
            </p>
          ) : null}
      </div>
      <h3 className="mt-2 font-serif text-2xl text-ink">{committee.name}</h3>
      <p className="mt-3 line-clamp-3 flex-1 text-sm text-ink-muted">
        {committee.description || "Committee briefing will be published with the study guide."}
      </p>
      <div className="mt-5 flex items-center justify-between text-xs text-ink-muted">
        <span>
          {committee.status === "CLOSED" || full
            ? "Waitlist / closed"
            : `${remaining} of ${committee.capacity} delegations remaining`}
        </span>
        <span>{committee.status}</span>
      </div>
    </Link>
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
