"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CurvedLoop } from "@/components/public/curved-loop";
import { announcementFingerprint } from "@/lib/announcement-ribbon";
import { cn } from "@/lib/format";
import { isHomeIntroDone, subscribeHomeIntro, syncHomeIntroPath } from "@/lib/intro-gate";

type RibbonItem = {
  id: string;
  title: string;
};

const SYNC_MS = 15_000;

export function AnnouncementRibbon({ announcements }: { announcements: RibbonItem[] }) {
  const pathname = usePathname();
  const propFingerprint = useMemo(() => announcementFingerprint(announcements), [announcements]);

  const [polledItems, setPolledItems] = useState<RibbonItem[] | null>(null);
  const [polledForFingerprint, setPolledForFingerprint] = useState<string | null>(null);

  const items =
    polledItems !== null && polledForFingerprint === propFingerprint
      ? polledItems
      : announcements;

  syncHomeIntroPath(pathname);
  const introDone = useSyncExternalStore(
    subscribeHomeIntro,
    isHomeIntroDone,
    () => pathname !== "/",
  );

  useEffect(() => {
    let active = true;

    const syncAnnouncements = async () => {
      try {
        const response = await fetch("/api/announcements", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok || !active) return;
        const next = (await response.json()) as RibbonItem[];
        setPolledItems(next);
        setPolledForFingerprint(propFingerprint);
      } catch {
        // Ignore transient network errors; server props still drive updates.
      }
    };

    const initial = window.setTimeout(() => void syncAnnouncements(), 0);
    const timer = window.setInterval(() => void syncAnnouncements(), SYNC_MS);
    const onFocus = () => void syncAnnouncements();
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncAnnouncements();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [propFingerprint]);

  const itemsFingerprint = useMemo(() => announcementFingerprint(items), [items]);
  const titles = useMemo(
    () => items.map((item) => item.title.trim()).filter(Boolean),
    [items],
  );
  const showRibbon = pathname === "/" && titles.length > 0;

  function scrollToAnnouncements() {
    document.getElementById("announcements")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!showRibbon) return null;

  const hideForIntro = !introDone;

  return (
    <div
      className={cn(
        "relative z-[35] border-b border-gold-400/40 bg-[linear-gradient(90deg,#1a1208_0%,#5c4520_42%,#8c6828_100%)] text-parchment-50 shadow-[0_2px_10px_rgba(26,18,8,0.2)] transition-opacity duration-700 ease-out",
        hideForIntro && "pointer-events-none opacity-0",
      )}
      aria-label="Latest announcements"
    >
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.05)_0,rgba(255,255,255,0.05)_1px,transparent_1px,transparent_10px)]" />
      <Link
        href="/#announcements"
        onClick={(event) => {
          if (pathname === "/") {
            event.preventDefault();
            scrollToAnnouncements();
          }
        }}
        className="group relative flex h-[var(--announcement-ribbon-height)] cursor-pointer items-center overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold-400"
      >
        <span className="relative z-10 flex h-full shrink-0 items-center border-r border-gold-400/25 bg-[#1a1208]/55 px-4 text-[10px] font-bold uppercase tracking-[0.32em] text-gold-400 sm:px-5">
          Latest
        </span>
        <div className="relative flex h-full min-w-0 flex-1 items-center overflow-hidden">
          <CurvedLoop
            key={itemsFingerprint}
            segments={titles}
            speed={1.5}
            curveAmount={0}
            direction="left"
            interactive={false}
            fitContainer
          />
        </div>
        <span className="pointer-events-none absolute inset-y-0 left-16 w-10 bg-gradient-to-r from-[#1a1208] to-transparent sm:left-20" />
        <span className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-[#8c6828] to-transparent" />
      </Link>
    </div>
  );
}
