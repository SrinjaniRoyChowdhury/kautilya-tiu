import Link from "next/link";
import { HiOutlineMail, HiOutlinePhone, HiOutlineLocationMarker } from "react-icons/hi";
import { BrandLogo } from "@/components/brand/logo";
import type { SiteSettings } from "@/types";

export function Footer({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="mt-16 border-t border-gold-700/20 bg-parchment-200/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <div className="flex items-center gap-3">
            <BrandLogo className="h-12 w-12 shrink-0" sizes="48px" />
            <p className="font-serif text-2xl text-gold-gradient">{settings.society_name}</p>
          </div>
          <p className="mt-2 max-w-xs text-sm text-ink-muted">
            {settings.tagline ?? "A college Model United Nations society."}
          </p>
        </div>
        <nav className="flex flex-col gap-2 text-sm" aria-label="Footer">
          <Link href="/about" className="hover:text-gold-700">
            About the society
          </Link>
          <Link href="/committees" className="hover:text-gold-700">
            Current committees
          </Link>
          <Link href="/editions" className="hover:text-gold-700">
            Past editions
          </Link>
          <Link href="/login" className="hover:text-gold-700">
            Delegate login
          </Link>
        </nav>
        <address className="not-italic text-sm text-ink-muted">
          {settings.contact_email ? (
            <p className="flex items-center gap-2">
              <HiOutlineMail aria-hidden /> {settings.contact_email}
            </p>
          ) : null}
          {settings.contact_phone ? (
            <p className="mt-2 flex items-center gap-2">
              <HiOutlinePhone aria-hidden /> {settings.contact_phone}
            </p>
          ) : null}
          {settings.contact_address ? (
            <p className="mt-2 flex items-start gap-2">
              <HiOutlineLocationMarker className="mt-0.5" aria-hidden />
              {settings.contact_address}
            </p>
          ) : null}
        </address>
      </div>
      <p className="border-t border-gold-700/15 py-4 text-center text-xs text-ink-muted">
        Platform reusable across editions. No paid services required to operate Phase 1.
      </p>
    </footer>
  );
}
