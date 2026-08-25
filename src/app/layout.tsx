import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getProfile, getRoleNames, getSessionUser, hasScanAccess } from "@/lib/auth";
import { getSiteSettings } from "@/lib/data";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Kautilya MUN",
    template: "%s · Kautilya MUN",
  },
  description:
    "Registration, credentials, and conference operations for Kautilya Model United Nations.",
  icons: {
    icon: "/KautilyaLogo.png",
    apple: "/KautilyaLogo.png",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [settings, user, profile, roles, canScan] = await Promise.all([
    getSiteSettings(),
    getSessionUser(),
    getProfile(),
    getRoleNames(),
    hasScanAccess(),
  ]);

  return (
    <html
      lang="en"
      className={`${outfit.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans text-ink">
        <Header
          societyName={settings.society_name}
          email={profile?.email ?? user?.email ?? null}
          isStaff={roles.length > 0}
          canScan={canScan}
        />
        <main className="flex-1">{children}</main>
        <Footer settings={settings} />
      </body>
    </html>
  );
}
