import type { Metadata } from "next";
import { AboutPageView } from "@/components/public/about-page-view";
import { Container } from "@/components/ui/card";
import { getSiteSettings } from "@/lib/data";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const settings = await getSiteSettings();
  return (
    <Container className="py-12">
      <AboutPageView settings={settings} />
    </Container>
  );
}
