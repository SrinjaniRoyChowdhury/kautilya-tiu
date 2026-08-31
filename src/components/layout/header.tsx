"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { HiOutlineMenu, HiOutlineX } from "react-icons/hi";
import { logoutAction } from "@/app/actions/auth";
import { BrandLogo } from "@/components/brand/logo";
import { cn } from "@/lib/format";
import { APP_NAME } from "@/lib/constants";
import { CLUB_NAME } from "@/lib/team";
import { isHomeIntroDone, subscribeHomeIntro } from "@/lib/intro-gate";

const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/committees", label: "Committees" },
  { href: "/executive-board", label: "Executive Board" },
  { href: "/editions", label: "Editions" },
  { href: "/team", label: "Team" },
  { href: "/gallery", label: "Gallery" },
  { href: "/rulebook", label: "Rules" },
  { href: "/contact", label: "Contact" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = {
  societyName: string;
  email: string | null;
  showAdmin: boolean;
  adminHref?: string;
  canScan: boolean;
};

export function Header({ societyName, email, showAdmin, adminHref = "/admin", canScan }: Props) {
  const pathname = usePathname();
  const introDone = useSyncExternalStore(
    subscribeHomeIntro,
    isHomeIntroDone,
    () => pathname !== "/",
  );
  const [open, setOpen] = useState(false);
  const hideForIntro = pathname === "/" && !introDone;
  const onAdmin = pathname.startsWith("/admin");
  const onScan = pathname.startsWith("/scan");
  const showDashboard = showAdmin || !canScan;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-gold-700/20 bg-parchment-50/90 font-heading backdrop-blur-md transition-opacity duration-700 ease-out",
        hideForIntro && "pointer-events-none opacity-0",
      )}
    >
      <div className="flex w-full items-center gap-3 px-4 py-3 sm:px-6 lg:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label={societyName}>
          <BrandLogo className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" priority />
          <span className="flex flex-col leading-none">
            <span className="font-serif text-xl font-bold tracking-wide whitespace-nowrap text-gold-700 sm:text-2xl uppercase">
              {APP_NAME.toUpperCase()}
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap text-gold-700">
              {CLUB_NAME}
            </span>
          </span>
        </Link>

        {!onScan ? (
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-5 lg:flex" aria-label="Primary">
          {links.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 border-b-2 pb-0.5 text-sm font-semibold whitespace-nowrap hover:text-gold-700",
                  active
                    ? "border-gold-700 text-gold-700"
                    : "border-transparent text-ink-muted",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        ) : (
          <div className="hidden min-w-0 flex-1 lg:block" />
        )}

        <div className="ml-auto hidden shrink-0 items-center gap-3 whitespace-nowrap lg:flex">
          {email ? (
            onAdmin ? null : (
            <>
              {showAdmin ? (
                <Link href={adminHref} className="text-sm font-semibold whitespace-nowrap text-gold-700 hover:underline">
                  Admin
                </Link>
              ) : null}
              {canScan ? (
                <Link href="/scan" className="text-sm font-semibold whitespace-nowrap text-gold-700 hover:underline">
                  Scan
                </Link>
              ) : null}
              {showDashboard ? (
              <Link href="/dashboard" className="text-sm font-semibold whitespace-nowrap text-ink-muted hover:text-gold-700">
                Dashboard
              </Link>
              ) : null}
              <form action={logoutAction} className="shrink-0">
                <button type="submit" className="text-sm font-semibold whitespace-nowrap text-ink-muted hover:text-gold-700">
                  Sign out
                </button>
              </form>
            </>
            )
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold whitespace-nowrap text-ink-muted hover:text-gold-700">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-10 shrink-0 items-center rounded-sm bg-gold-700 px-4 text-sm font-semibold whitespace-nowrap text-parchment-50"
              >
                Register
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center text-gold-700 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <HiOutlineX size={22} /> : <HiOutlineMenu size={22} />}
          <span className="sr-only">Menu</span>
        </button>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-gold-700/15 px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-3" aria-label="Mobile">
            {!onScan
              ? links.map((link) => {
              const active = isActivePath(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "w-fit border-b-2 pb-0.5 text-base font-semibold",
                    active
                      ? "border-gold-700 text-gold-700"
                      : "border-transparent text-ink",
                  )}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })
              : null}
            {email ? (
              onAdmin ? null : (
              <>
                {showDashboard ? (
                <Link href="/dashboard" className="font-semibold" onClick={() => setOpen(false)}>
                  Dashboard
                </Link>
                ) : null}
                {showAdmin ? (
                  <Link href={adminHref} className="font-semibold" onClick={() => setOpen(false)}>
                    Admin
                  </Link>
                ) : null}
                {canScan ? (
                  <Link href="/scan" className="font-semibold" onClick={() => setOpen(false)}>
                    Scan
                  </Link>
                ) : null}
                <form action={logoutAction}>
                  <button type="submit" className="font-semibold whitespace-nowrap">Sign out</button>
                </form>
              </>
              )
            ) : (
              <>
                <Link href="/login" className="font-semibold" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
                <Link href="/signup" className="font-semibold" onClick={() => setOpen(false)}>
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
