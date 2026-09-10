"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, useEffect, useRef } from "react";
import { HiOutlineMenu, HiOutlineX, HiOutlineLogin, HiOutlineUserAdd, HiOutlineLogout, HiArrowRight } from "react-icons/hi";
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

// ── Shared popover shell ──────────────────────────────────────────────────────
function Popover({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-md border border-gold-700/20 bg-parchment-50 p-4 shadow-xl ring-1 ring-gold-700/10 animate-in fade-in slide-in-from-top-1 duration-150"
    >
      {children}
    </div>
  );
}

// ── Sign-out confirm popover ──────────────────────────────────────────────────
function SignOutPopover({ onClose }: { onClose: () => void }) {
  return (
    <Popover onClose={onClose}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold-700">
        <HiOutlineLogout className="h-4 w-4" />
        Sign out
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        Are you sure you want to sign out of your account?
      </p>
      <div className="mt-4 flex items-center gap-2">
        <form action={logoutAction} className="flex-1">
          <button
            type="submit"
            className="w-full rounded-sm bg-gold-700 px-3 py-1.5 text-sm font-semibold text-parchment-50 transition hover:bg-gold-700/90"
          >
            Yes, sign out
          </button>
        </form>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-sm border border-gold-700/25 px-3 py-1.5 text-sm font-semibold text-ink-muted transition hover:border-gold-700/50 hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </Popover>
  );
}

// ── Sign-in teaser popover ────────────────────────────────────────────────────
function SignInPopover({ onClose }: { onClose: () => void }) {
  return (
    <Popover onClose={onClose}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold-700">
        <HiOutlineLogin className="h-4 w-4" />
        Sign in
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        Already registered? Sign in to access your delegate dashboard and manage your participation.
      </p>
      <Link
        href="/login"
        onClick={onClose}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm bg-gold-700 px-3 py-1.5 text-sm font-semibold text-parchment-50 transition hover:bg-gold-700/90"
      >
        Go to sign-in <HiArrowRight className="h-4 w-4" />
      </Link>
    </Popover>
  );
}

// ── Register teaser popover ───────────────────────────────────────────────────
function RegisterPopover({ onClose }: { onClose: () => void }) {
  return (
    <Popover onClose={onClose}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold-700">
        <HiOutlineUserAdd className="h-4 w-4" />
        Create account
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        New to Kautilya MUN? Register to secure your delegation and join the conference.
      </p>
      <Link
        href="/signup"
        onClick={onClose}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm bg-gold-700 px-3 py-1.5 text-sm font-semibold text-parchment-50 transition hover:bg-gold-700/90"
      >
        Register now <HiArrowRight className="h-4 w-4" />
      </Link>
    </Popover>
  );
}

// ── Mobile confirm for sign-out ───────────────────────────────────────────────
function MobileSignOutConfirm({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="mt-1 rounded-md border border-gold-700/20 bg-parchment-100 p-3">
      <p className="text-sm text-ink-muted">Are you sure you want to sign out?</p>
      <div className="mt-3 flex gap-2">
        <form action={logoutAction} className="flex-1">
          <button
            type="submit"
            className="w-full rounded-sm bg-gold-700 px-3 py-1.5 text-sm font-semibold text-parchment-50"
          >
            Yes, sign out
          </button>
        </form>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-sm border border-gold-700/25 px-3 py-1.5 text-sm font-medium text-ink-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main header ───────────────────────────────────────────────────────────────
type Props = {
  societyName: string;
  email: string | null;
  showAdmin: boolean;
  adminHref?: string;
  canScan: boolean;
};

type PopoverKind = "signout" | "signin" | "register" | null;

export function Header({ societyName, email, showAdmin, adminHref = "/admin", canScan }: Props) {
  const pathname = usePathname();
  const introDone = useSyncExternalStore(
    subscribeHomeIntro,
    isHomeIntroDone,
    () => pathname !== "/",
  );
  const [open, setOpen] = useState(false);
  const [popover, setPopover] = useState<PopoverKind>(null);
  const [mobileSignOut, setMobileSignOut] = useState(false);

  const hideForIntro = pathname === "/" && !introDone;
  const onAdmin = pathname.startsWith("/admin");
  const onScan = pathname.startsWith("/scan");
  const showDashboard = showAdmin || !canScan;

  function togglePopover(kind: PopoverKind) {
    setPopover((prev) => (prev === kind ? null : kind));
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-gold-700/20 font-heading transition-opacity duration-700 ease-out",
        onAdmin ? "bg-parchment-50" : "bg-parchment-50/90 backdrop-blur-md",
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

        {/* Desktop auth buttons */}
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

                {/* Sign-out with confirm popover */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => togglePopover("signout")}
                    className={cn(
                      "text-sm font-semibold whitespace-nowrap transition",
                      popover === "signout" ? "text-gold-700" : "text-ink-muted hover:text-gold-700",
                    )}
                  >
                    Sign out
                  </button>
                  {popover === "signout" && (
                    <SignOutPopover onClose={() => setPopover(null)} />
                  )}
                </div>
              </>
            )
          ) : (
            <>
              {/* Sign-in with teaser popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => togglePopover("signin")}
                  className={cn(
                    "text-sm font-semibold whitespace-nowrap transition",
                    popover === "signin" ? "text-gold-700" : "text-ink-muted hover:text-gold-700",
                  )}
                >
                  Sign in
                </button>
                {popover === "signin" && (
                  <SignInPopover onClose={() => setPopover(null)} />
                )}
              </div>

              {/* Register with teaser popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => togglePopover("register")}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center rounded-sm px-4 text-sm font-semibold whitespace-nowrap transition",
                    popover === "register"
                      ? "bg-gold-700/80 text-parchment-50"
                      : "bg-gold-700 text-parchment-50 hover:bg-gold-700/90",
                  )}
                >
                  Register
                </button>
                {popover === "register" && (
                  <RegisterPopover onClose={() => setPopover(null)} />
                )}
              </div>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center text-gold-700 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => { setOpen((v) => !v); setMobileSignOut(false); }}
        >
          {open ? <HiOutlineX size={22} /> : <HiOutlineMenu size={22} />}
          <span className="sr-only">Menu</span>
        </button>
      </div>

      {/* Mobile nav */}
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

                  {/* Mobile sign-out with inline confirm */}
                  <div>
                    {!mobileSignOut ? (
                      <button
                        type="button"
                        className="font-semibold whitespace-nowrap text-ink-muted"
                        onClick={() => setMobileSignOut(true)}
                      >
                        Sign out
                      </button>
                    ) : (
                      <MobileSignOutConfirm onCancel={() => setMobileSignOut(false)} />
                    )}
                  </div>
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
