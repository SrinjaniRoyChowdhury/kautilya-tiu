import type { Metadata } from "next";
import { HiOutlineMail, HiOutlinePhone, HiOutlineLocationMarker } from "react-icons/hi";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getSiteSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const settings = await getSiteSettings();
  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Secretariat"
        title="Contact"
        description="For allocations, payments, and conference logistics."
      />
      <Card className="max-w-lg space-y-4 text-ink-muted">
        {settings.contact_email ? (
          <p className="flex items-center gap-2">
            <HiOutlineMail className="text-gold-700" aria-hidden />
            <a className="text-gold-700 hover:underline" href={`mailto:${settings.contact_email}`}>
              {settings.contact_email}
            </a>
          </p>
        ) : null}
        {settings.contact_phone ? (
          <p className="flex items-center gap-2">
            <HiOutlinePhone className="text-gold-700" aria-hidden />
            {settings.contact_phone}
          </p>
        ) : null}
        {settings.contact_address ? (
          <p className="flex items-start gap-2">
            <HiOutlineLocationMarker className="mt-0.5 text-gold-700" aria-hidden />
            {settings.contact_address}
          </p>
        ) : null}
        {settings.instagram_url ? (
          <p>
            <a className="text-gold-700 hover:underline" href={settings.instagram_url}>
              Instagram
            </a>
          </p>
        ) : null}
        {settings.linkedin_url ? (
          <p>
            <a className="text-gold-700 hover:underline" href={settings.linkedin_url}>
              LinkedIn
            </a>
          </p>
        ) : null}
      </Card>
    </Container>
  );
}
