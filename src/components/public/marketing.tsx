import Link from "next/link";
import { HiArrowRight } from "react-icons/hi";
import { BrandLogo } from "@/components/brand/logo";
import { CommitteeFeeBlock } from "@/components/public/committee-fees";
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
        <span>
          {committee.status === "CLOSED" || full
            ? "Waitlist / closed"
            : `${remaining} of ${committee.capacity} delegations remaining`}
        </span>
        <span className="rounded-sm border border-gold-700/20 px-2 py-0.5 font-medium uppercase tracking-wide">
          {committee.status}
        </span>
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
