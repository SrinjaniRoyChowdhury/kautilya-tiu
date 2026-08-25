import type { Metadata } from "next";
import { ContactDesk } from "@/components/public/contact-desk";
import { Container } from "@/components/ui/card";
import { getActiveEdition, getSiteSettings, getTeamMembers } from "@/lib/data";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Write the Kautilya MUN secretariat — delegates, sponsors, faculty, and press are all welcome at the desk.",
};

export default async function ContactPage() {
  const [settings, members, edition] = await Promise.all([
    getSiteSettings(),
    getTeamMembers(),
    getActiveEdition(),
  ]);

  return (
    <Container className="py-12 sm:py-16">
      <ContactDesk settings={settings} members={members} edition={edition} />
    </Container>
  );
}
