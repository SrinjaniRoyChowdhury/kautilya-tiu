import type { Metadata } from "next";
import { ContactDesk } from "@/components/public/contact-desk";
import { Container } from "@/components/ui/card";
import { getActiveEdition, getSiteSettings } from "@/lib/data";
import { HARDCODED_TEAM } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Write the Kautilya MUN secretariat — delegates, sponsors, faculty, and press are all welcome at the desk.",
};

export default async function ContactPage() {
  const [settings, edition] = await Promise.all([
    getSiteSettings(),
    getActiveEdition(),
  ]);

  return (
    <Container className="py-12 sm:py-16">
      <ContactDesk settings={settings} members={HARDCODED_TEAM} edition={edition} />
    </Container>
  );
}
