"use client";

import { MotionReveal, MotionStagger, MotionStaggerItem } from "@/components/motion/reveal";
import {
  CLUB_NAME,
  EVENT_EDITION,
  EVENT_NAME,
  HOST_UNIVERSITY,
  type CoreOfficer,
  type UsgDepartment,
} from "@/lib/team";

function Names({ names, className }: { names: string[]; className: string }) {
  return (
    <span className={className}>
      {names.map((name, index) => (
        <span key={`${name}-${index}`}>
          {index > 0 ? <span className="mx-2 font-serif text-[0.7em] text-gold-400">&</span> : null}
          {name}
        </span>
      ))}
    </span>
  );
}

function OfficerCard({ officer, featured = false }: { officer: CoreOfficer; featured?: boolean }) {
  const initials = officer.names
    .map((name) => name[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  return (
    <article
      className={`group relative aspect-square w-full overflow-hidden rounded-md border border-gold-700/30 bg-[#120e08] text-parchment-50 shadow-lg transition-all duration-300 hover:border-gold-400/80 hover:shadow-[0_0_28px_rgba(212,175,98,0.25)] ${
        featured ? "sm:col-span-2 lg:col-span-2" : ""
      }`}
    >
      {officer.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={officer.photo_url}
          alt={officer.names.join(" & ")}
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1e160c] via-[#120e08] to-[#0a0704] p-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-gold-500/30 bg-gold-900/30 font-heading text-2xl font-bold tracking-widest text-gold-300 shadow-inner transition-colors group-hover:border-gold-400/60 group-hover:bg-gold-800/40">
            {initials || "SG"}
          </div>
        </div>
      )}

      {/* Ambient gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent transition-opacity duration-300 group-hover:via-black/25" />

      {/* Top Badge for Featured (e.g. Secretary-General) */}
      {featured ? (
        <div className="absolute top-4 left-4 z-10">
          <span className="rounded-sm border border-gold-400/40 bg-gold-950/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-gold-300 backdrop-blur-md">
            Secretariat Lead
          </span>
        </div>
      ) : null}

      {/* Bottom Content */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-400 drop-shadow-sm">
          {officer.role}
        </p>
        <h3 className={`mt-1 font-serif font-bold tracking-tight text-parchment-50 drop-shadow-md ${featured ? "text-2xl sm:text-3xl lg:text-4xl" : "text-xl sm:text-2xl"}`}>
          <Names names={officer.names} className="inline" />
        </h3>
      </div>
    </article>
  );
}

function UsgCard({ department }: { department: UsgDepartment }) {
  return (
    <article className="group relative flex aspect-square w-full flex-col justify-between overflow-hidden rounded-md border border-gold-700/25 bg-parchment-50/95 p-6 shadow-md transition-all duration-300 hover:border-gold-500/60 hover:shadow-[0_0_20px_rgba(212,175,98,0.18)] dark:bg-[#120e08] dark:text-parchment-50">
      <div className="flex items-center justify-between">
        <span className="rounded-sm border border-gold-700/20 bg-gold-700/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gold-700 dark:border-gold-500/30 dark:bg-gold-900/30 dark:text-gold-300">
          USG
        </span>
      </div>

      <div className="my-auto py-3">
        <h3 className="font-serif text-xl font-bold text-ink transition-colors group-hover:text-gold-700 sm:text-2xl dark:text-parchment-50 dark:group-hover:text-gold-300">
          {department.title}
        </h3>
      </div>

      <div className="border-t border-gold-700/15 pt-3 dark:border-gold-700/30">
        {department.names.length ? (
          <p className="font-serif text-sm font-semibold text-ink-muted transition-colors group-hover:text-ink sm:text-base dark:text-parchment-200 dark:group-hover:text-parchment-50">
            <Names names={department.names} className="inline" />
          </p>
        ) : (
          <p className="text-xs italic text-ink-muted/70 dark:text-parchment-300/60">Office incumbent</p>
        )}
      </div>
    </article>
  );
}

export function SecretariatRoster({ core, usgs }: { core: CoreOfficer[]; usgs: UsgDepartment[] }) {
  const [secretaryGeneral, ...rest] = core;
  return (
    <div className="grid gap-16">
      <MotionReveal as="header" className="max-w-3xl" immediate>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-700">
          {CLUB_NAME} · {HOST_UNIVERSITY}
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-gold-gradient sm:text-6xl">
          {EVENT_NAME} {EVENT_EDITION}
        </h1>
        <p className="mt-4 max-w-xl text-base text-ink-muted">
          The Annual Model United Nations Conference of {HOST_UNIVERSITY}.
        </p>
      </MotionReveal>

      <MotionReveal as="section" aria-labelledby="core-heading" delay={0.06}>
        <h2 id="core-heading" className="font-serif text-2xl text-gold-700 sm:text-3xl">
          Core Secretariat
        </h2>
        <MotionStagger className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {secretaryGeneral ? (
            <MotionStaggerItem key={secretaryGeneral.id} className={rest.length % 2 === 0 ? "sm:col-span-2 lg:col-span-2" : undefined}>
              <OfficerCard officer={secretaryGeneral} featured={rest.length % 2 === 0} />
            </MotionStaggerItem>
          ) : null}
          {rest.map((officer) => (
            <MotionStaggerItem key={officer.id}>
              <OfficerCard officer={officer} />
            </MotionStaggerItem>
          ))}
        </MotionStagger>
      </MotionReveal>

      <MotionReveal as="section" aria-labelledby="usg-heading" delay={0.1}>
        <h2 id="usg-heading" className="font-serif text-2xl text-gold-700 sm:text-3xl">
          Under-Secretary-General Departments
        </h2>
        <MotionStagger className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {usgs.map((department) => (
            <MotionStaggerItem key={department.id}>
              <UsgCard department={department} />
            </MotionStaggerItem>
          ))}
        </MotionStagger>
      </MotionReveal>
    </div>
  );
}
