"use client";

import Link from "next/link";
import { useState } from "react";
import { HiOutlineMenu, HiOutlineX } from "react-icons/hi";
import { logoutAction } from "@/app/actions/auth";
import { BrandLogo } from "@/components/brand/logo";

const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/committees", label: "Committees" },
  { href: "/editions", label: "Editions" },
  { href: "/team", label: "Team" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
];

type Props = {
  societyName: string;
  email: string | null;
  isStaff: boolean;
  canScan: boolean;
};

export function Header({ societyName, email, isStaff, canScan }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-gold-700/20 bg-parchment-50/90 font-heading backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <BrandLogo className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" priority />
          <span className="flex min-w-0 flex-col leading-none">
            <span className="font-serif text-xl font-semibold tracking-wide text-gold-700 sm:text-2xl">
              Kautilya
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-gold-700">
              Model United Nations
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-ink-muted hover:text-gold-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {email ? (
            <>
              {isStaff ? (
                <Link href="/admin" className="text-sm text-gold-700 hover:underline">
                  Admin
                </Link>
              ) : null}
              {canScan ? (
                <Link href="/scan" className="text-sm text-gold-700 hover:underline">
                  Scan
                </Link>
              ) : null}
              <Link href="/dashboard" className="text-sm text-ink-muted hover:text-gold-700">
                Dashboard
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="text-sm text-ink-muted hover:text-gold-700">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-ink-muted hover:text-gold-700">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-10 items-center rounded-sm bg-gold-700 px-4 text-sm font-medium text-parchment-50"
              >
                Register
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center text-gold-700 lg:hidden"
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
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-base text-ink"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {email ? (
              <>
                <Link href="/dashboard" onClick={() => setOpen(false)}>
                  Dashboard
                </Link>
                {isStaff ? (
                  <Link href="/admin" onClick={() => setOpen(false)}>
                    Admin
                  </Link>
                ) : null}
                {canScan ? (
                  <Link href="/scan" onClick={() => setOpen(false)}>
                    Scan
                  </Link>
                ) : null}
                <form action={logoutAction}>
                  <button type="submit">Sign out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)}>
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
