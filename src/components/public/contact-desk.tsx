import Link from "next/link";
import { FaInstagram } from "react-icons/fa";
import { HiArrowRight, HiOutlineLocationMarker, HiOutlineMail } from "react-icons/hi";
import { ContactLetterForm } from "@/components/public/contact-letter-form";
import { BrandLogo } from "@/components/brand/logo";
import {
  ARTHASHASTRA,
  CONTACT_DESKS,
  CONTACT_PEOPLE,
  VENUE,
  deskMailto,
  instagramHandle,
  mapsEmbedSrc,
  mapsOpenUrl,
  telHref,
} from "@/lib/contact";
import { formatDateRange } from "@/lib/format";
import type { Edition, SiteSettings, TeamMember } from "@/types";

function Initials({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1a1208] font-heading text-sm font-semibold text-gold-400">
      {letters || "KM"}
    </span>
  );
}

export function ContactDesk({
  settings,
  members,
  edition,
}: {
  settings: SiteSettings;
  members: TeamMember[];
  edition: Edition | null;
}) {
  const email = settings.contact_email ?? "tiukautilya@gmail.com";
  const instagram = settings.instagram_url || "https://www.instagram.com/kautilya_tiu/";
  const desks = CONTACT_DESKS.filter((desk) => desk.id !== "other");

  return (
    <div className="flex flex-col gap-14">
      <header className="max-w-3xl">
        <div className="flex items-center gap-4">
          <BrandLogo className="h-16 w-16 sm:h-20 sm:w-20" sizes="80px" priority />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-700">
            The desk is open
          </p>
        </div>
        <h1 className="mt-6 font-serif text-4xl font-semibold tracking-tight text-gold-gradient sm:text-6xl">
          Counsel the secretariat
        </h1>
        <blockquote className="mt-6 border-l-2 border-gold-400 pl-4">
          <p className="font-serif text-xl text-ink sm:text-2xl">“{ARTHASHASTRA.quote}”</p>
          <footer className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">
            {ARTHASHASTRA.attribution}
          </footer>
        </blockquote>
        <p className="mt-6 max-w-2xl text-base leading-7 text-ink-muted">
          Delegates, sponsors, faculty, press, and anyone else who needs the conference — this is
          the desk. Write a letter, pick a desk, or open the work you already started.
        </p>
      </header>

      <section aria-labelledby="desks-heading">
        <h2 id="desks-heading" className="font-serif text-2xl text-gold-700">
          Three desks
        </h2>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          One action each. Call the help desk if you need someone now.
        </p>
        <div className="mt-6 grid border-y border-gold-700/25 md:grid-cols-3 md:divide-x md:divide-gold-700/20">
          {desks.map((desk, index) => (
            <article key={desk.id} className="flex flex-col py-6 md:px-6 md:first:pl-0 md:last:pr-0">
              <p className="font-heading text-xs font-semibold tracking-[0.22em] text-gold-400">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 font-serif text-2xl text-ink">{desk.label}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-ink-muted">{desk.brief}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {desk.id === "delegate" ? (
                  <>
                    <Link
                      href="/dashboard/register"
                      className="inline-flex h-10 items-center gap-2 rounded-sm bg-gold-700 px-4 text-sm font-medium text-parchment-50"
                    >
                      Register <HiArrowRight />
                    </Link>
                    <Link
                      href="/dashboard"
                      className="inline-flex h-10 items-center rounded-sm border border-gold-700/40 px-4 text-sm font-medium text-gold-700"
                    >
                      Dashboard
                    </Link>
                  </>
                ) : (
                  <a
                    href={deskMailto(email, desk.id)}
                    className="inline-flex h-10 items-center gap-2 rounded-sm bg-gold-700 px-4 text-sm font-medium text-parchment-50"
                  >
                    Write this desk <HiOutlineMail />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-5">
        <section className="relative lg:col-span-3" aria-labelledby="letter-heading">
          <div className="frame-gold bg-parchment-50/90 p-6 sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-700">
                  A letter, not a ticket
                </p>
                <h2 id="letter-heading" className="mt-2 font-serif text-3xl text-ink">
                  Write the secretariat
                </h2>
                <p className="mt-2 text-sm text-ink-muted">
                  Seal the note and send it from your own mail app to {email}.
                </p>
              </div>
              <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#1a1208] ring-2 ring-gold-400 sm:flex">
                <BrandLogo className="h-10 w-10 drop-shadow-[0_0_8px_rgba(212,175,98,0.45)]" sizes="40px" />
              </div>
            </div>
            <ContactLetterForm to={email} />
          </div>
        </section>

        <aside className="flex flex-col gap-4 lg:col-span-2">
          <section className="bg-[#1a1208] p-6 text-parchment-100" aria-labelledby="hours-heading">
            <h2 id="hours-heading" className="font-serif text-2xl text-gold-400">
              When the desk replies
            </h2>
            <p className="mt-3 text-sm leading-6 text-parchment-200">
              Letters are read every day. You should hear back within twenty-four hours.
            </p>
            <p className="mt-3 text-sm leading-6 text-parchment-200">
              On conference days the helpdesk is open 08:00–20:00 in the ground-floor lobby.
            </p>
            {edition ? (
              <p className="mt-4 border-t border-gold-400/20 pt-4 text-sm text-parchment-300">
                {edition.name}
                {edition.theme ? ` · ${edition.theme}` : ""} ·{" "}
                {formatDateRange(edition.start_date, edition.end_date)}
              </p>
            ) : null}
            <ul className="mt-4 space-y-3 border-t border-gold-400/20 pt-4">
              {CONTACT_PEOPLE.map((person) => (
                <li key={person.phone}>
                  {person.label ? (
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">
                      {person.label}
                    </p>
                  ) : null}
                  <p className="font-heading text-sm font-semibold text-parchment-50">{person.name}</p>
                  <a className="text-sm text-gold-400 hover:underline" href={telHref(person.phone)}>
                    {person.phone}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <a
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 border border-gold-700/25 bg-parchment-50/80 px-5 py-4 text-gold-700 hover:bg-parchment-100"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1a1208] text-gold-400">
              <FaInstagram aria-hidden />
            </span>
            <span>
              <span className="block text-xs font-semibold uppercase tracking-[0.18em]">
                The curtains
              </span>
              <span className="font-heading text-sm">{instagramHandle(instagram)}</span>
            </span>
          </a>
        </aside>
      </div>

      <section aria-labelledby="venue-heading">
        <div className="mt-2 grid overflow-hidden border border-gold-700/25 bg-parchment-50/80 md:grid-cols-2">
          <div className="flex flex-col justify-center p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-700">
              How to reach
            </p>
            <h2 id="venue-heading" className="mt-2 font-serif text-3xl text-ink">
              {VENUE.name}
            </h2>
            {VENUE.lines.map((line) => (
              <p key={line} className="mt-1 text-sm text-ink-muted">
                {line}
              </p>
            ))}
            <ul className="mt-5 space-y-2 text-sm leading-6 text-ink">
              <li>Nearest metro: Sector V, Salt Lake (Green Line).</li>
              <li>Campus gate on EM-4/1 — follow signs for the university lobby.</li>
              <li>Conference helpdesk: ground-floor lobby, registration tables.</li>
            </ul>
            <a
              href={mapsOpenUrl(VENUE.query)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-sm text-gold-700 hover:underline"
            >
              <HiOutlineLocationMarker aria-hidden />
              Open this map in Google Maps
            </a>
          </div>
          <div className="min-h-[280px] bg-parchment-200 md:min-h-[420px]">
            <iframe
              title={`${VENUE.name} on Google Maps`}
              src={mapsEmbedSrc(VENUE.query)}
              className="h-full min-h-[280px] w-full border-0 md:min-h-[420px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {members.length ? (
        <section aria-labelledby="faces-heading">
          <div className="flex items-end justify-between gap-4">
            <h2 id="faces-heading" className="font-serif text-2xl text-gold-700">
              Who reads the desk
            </h2>
            <Link href="/team" className="text-sm text-gold-700 hover:underline">
              Full secretariat
            </Link>
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-3">
                <Initials name={member.full_name} />
                <div>
                  <p className="font-heading text-sm font-semibold text-ink">{member.full_name}</p>
                  <p className="text-xs uppercase tracking-[0.14em] text-gold-700">
                    {member.role_title}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
