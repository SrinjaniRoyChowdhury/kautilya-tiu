import type { Metadata } from "next";
import { Montserrat, Poppins, Geist } from "next/font/google";
import { AnnouncementRibbon } from "@/components/public/announcement-ribbon";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getProfile, getRoleNames, getSessionUser, hasScanAccess } from "@/lib/auth";
import { isOperatorOnly } from "@/lib/roles";
import { staffHomePath } from "@/lib/staff-access";
import { APP_NAME } from "@/lib/constants";
import { getActiveEdition, getAnnouncements, getSiteSettings } from "@/lib/data";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Registration, credentials, and conference operations for Kautilya — Kautilya MUN Nitisabha's Model United Nations conference.",
  icons: {
    icon: "/KautilyaLogo.png",
    apple: "/KautilyaLogo.png",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [settings, user, profile, roles, canScan, edition] = await Promise.all([
    getSiteSettings(),
    getSessionUser(),
    getProfile(),
    getRoleNames(),
    hasScanAccess(),
    getActiveEdition(),
  ]);
  const announcements = edition ? await getAnnouncements(edition.id) : [];

  const scannerOnly = isOperatorOnly(roles);

  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", poppins.variable, montserrat.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full flex flex-col font-sans text-ink">
        <Header
          societyName={settings.society_name}
          email={profile?.email ?? user?.email ?? null}
          showAdmin={roles.length > 0 && !scannerOnly}
          adminHref={staffHomePath(roles)}
          canScan={canScan}
        />
        <AnnouncementRibbon announcements={announcements} />
        <main className="flex-1">{children}</main>
        {scannerOnly ? null : <Footer settings={settings} />}
      </body>
    </html>
  );
}
