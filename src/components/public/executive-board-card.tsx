"use client";

import type { EbMember } from "@/types";

export function ExecutiveBoardCard({
  member,
  committeeShortName,
}: {
  member: EbMember;
  committeeShortName?: string;
}) {
  const initials = member.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <article className="group relative aspect-square w-full overflow-hidden rounded-md border border-gold-700/30 bg-[#120e08] text-parchment-50 shadow-md transition-all duration-300 hover:border-gold-400/80 hover:shadow-[0_0_24px_rgba(212,175,98,0.22)]">
      {member.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.photo_url}
          alt={member.name}
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1e160c] via-[#120e08] to-[#0a0704] p-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-gold-500/30 bg-gold-900/30 font-heading text-2xl font-bold tracking-widest text-gold-300 shadow-inner group-hover:border-gold-400/60 group-hover:bg-gold-800/40 transition-colors">
            {initials || "EB"}
          </div>
        </div>
      )}

      {/* Ambient gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent transition-opacity duration-300 group-hover:via-black/25" />

      {/* Top Committee Tag */}
      {committeeShortName ? (
        <div className="absolute top-3.5 right-3.5 z-10">
          <span className="rounded-sm border border-gold-700/40 bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold-300 backdrop-blur-md">
            {committeeShortName}
          </span>
        </div>
      ) : null}

      {/* Bottom Content Info */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-400 drop-shadow-sm">
          {member.title || "Executive Board"}
        </p>
        <h3 className="mt-1 font-serif text-lg font-bold tracking-tight text-parchment-50 drop-shadow-md sm:text-xl md:text-2xl">
          {member.name}
        </h3>
      </div>
    </article>
  );
}
