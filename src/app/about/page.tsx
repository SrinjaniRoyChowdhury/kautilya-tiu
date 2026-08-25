import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui/card";
import { PlainCopy } from "@/components/public/marketing";
import { getSiteSettings } from "@/lib/data";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const settings = await getSiteSettings();
  return (
    <Container className="py-12">
      <PageHeader eyebrow="The society" title="About" description={settings.tagline ?? undefined} />
      <article className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="font-serif text-2xl text-gold-700">Who we are</h2>
          <PlainCopy
            className="mt-3"
            text={settings.about_html}
            fallback="About copy is managed in the CMS."
          />
        </section>
        <section>
          <h2 className="font-serif text-2xl text-gold-700">Mission</h2>
          <PlainCopy
            className="mt-3"
            text={settings.mission_html}
            fallback="Mission copy is managed in the CMS."
          />
        </section>
        <section className="lg:col-span-2">
          <h2 className="font-serif text-2xl text-gold-700">History</h2>
          <PlainCopy
            className="mt-3"
            text={settings.history_html}
            fallback="History copy is managed in the CMS."
          />
        </section>
      </article>
    </Container>
  );
}
