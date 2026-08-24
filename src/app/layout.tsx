import type { Metadata } from "next";
import { Montserrat, Poppins } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getProfile, getRoleNames, getSessionUser } from "@/lib/auth";
import { getSiteSettings } from "@/lib/data";
import "./globals.css";

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
  const [settings, user, profile, roles] = await Promise.all([
    getSiteSettings(),
    getSessionUser(),
    getProfile(),
    getRoleNames(),
  ]);

  return (
    <html
      lang="en"
      className={`${poppins.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans text-ink">
        <Header
          societyName={settings.society_name}
          email={profile?.email ?? user?.email ?? null}
          isStaff={roles.length > 0}
        />
        <main className="flex-1">{children}</main>
        <Footer settings={settings} />
      </body>
    </html>
  );
}
