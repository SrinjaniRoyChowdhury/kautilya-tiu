import type { Metadata } from "next";
import { ContactDesk } from "@/components/public/contact-desk";
import { Container } from "@/components/ui/card";
import { getActiveEdition, getSiteSettings, getTeamMembers } from "@/lib/data";
import { contactFaces } from "@/lib/team";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Write the Kautilya secretariat — delegates, sponsors, faculty, and press are all welcome at the desk.",
};

export default async function ContactPage() {
  const [settings, edition, members] = await Promise.all([
    getSiteSettings(),
    getActiveEdition(),
    getTeamMembers(),
  ]);

  return (
    <Container className="py-12 sm:py-16">
      <ContactDesk settings={settings} members={contactFaces(members, settings)} edition={edition} />
    </Container>
  );
}
