import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui/card";
import { sanitizeHtml } from "@/lib/sanitize";
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
          <div
            className="mt-3 space-y-3 text-ink-muted [&_p]:leading-7"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(settings.about_html) || "<p>About copy is managed in the CMS.</p>",
            }}
          />
        </section>
        <section>
          <h2 className="font-serif text-2xl text-gold-700">Mission</h2>
          <div
            className="mt-3 space-y-3 text-ink-muted [&_p]:leading-7"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(settings.mission_html) || "<p>Mission copy is managed in the CMS.</p>",
            }}
          />
        </section>
        <section className="lg:col-span-2">
          <h2 className="font-serif text-2xl text-gold-700">History</h2>
          <div
            className="mt-3 space-y-3 text-ink-muted [&_p]:leading-7"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(settings.history_html) || "<p>History copy is managed in the CMS.</p>",
            }}
          />
        </section>
      </article>
    </Container>
  );
}
