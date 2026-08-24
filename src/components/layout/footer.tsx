import Link from "next/link";
import { FaInstagram } from "react-icons/fa";
import { HiOutlineMail, HiOutlinePhone, HiOutlineLocationMarker } from "react-icons/hi";
import { BrandLogo } from "@/components/brand/logo";
import type { SiteSettings } from "@/types";

export function Footer({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="mt-16 bg-[#1a1208] text-parchment-100">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <div className="flex items-center gap-3">
            <BrandLogo
              className="h-12 w-12 shrink-0 drop-shadow-[0_0_12px_rgba(212,175,98,0.45)]"
              sizes="48px"
            />
            <p className="font-serif text-2xl font-semibold text-gold-400">{settings.society_name}</p>
          </div>
          <p className="mt-2 max-w-xs text-sm text-parchment-300">
            {settings.tagline ?? "A college Model United Nations society."}
          </p>
        </div>
        <nav className="flex flex-col gap-2 text-sm text-parchment-200" aria-label="Footer">
          <Link href="/about" className="hover:text-gold-400">
            About the society
          </Link>
          <Link href="/committees" className="hover:text-gold-400">
            Current committees
          </Link>
          <Link href="/editions" className="hover:text-gold-400">
            Past editions
          </Link>
          <Link href="/login" className="hover:text-gold-400">
            Delegate login
          </Link>
        </nav>
        <address className="not-italic text-sm text-parchment-200">
          {settings.contact_email ? (
            <p className="flex items-center gap-2">
              <HiOutlineMail className="text-gold-400" aria-hidden />
              <a className="hover:text-gold-400" href={`mailto:${settings.contact_email}`}>
                {settings.contact_email}
              </a>
            </p>
          ) : null}
          {settings.contact_phone ? (
            <p className="mt-2 flex items-center gap-2">
              <HiOutlinePhone className="text-gold-400" aria-hidden /> {settings.contact_phone}
            </p>
          ) : null}
          {settings.contact_address ? (
            <p className="mt-2 flex items-start gap-2">
              <HiOutlineLocationMarker className="mt-0.5 text-gold-400" aria-hidden />
              {settings.contact_address}
            </p>
          ) : null}
          {settings.instagram_url ? (
            <p className="mt-2">
              <a
                href={settings.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-gold-400"
              >
                <FaInstagram className="text-gold-400" aria-hidden /> Instagram
              </a>
            </p>
          ) : null}
        </address>
      </div>
      <div className="border-t border-gold-400/20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 text-xs text-parchment-300 sm:px-6">
          <p>© {new Date().getFullYear()} {settings.society_name}. All rights reserved.</p>
          <p className="text-right">
            Behind the digital curtain: Srinjani Roy Chowdhury and Pratik Guha Roy
          </p>
        </div>
      </div>
    </footer>
  );
}
