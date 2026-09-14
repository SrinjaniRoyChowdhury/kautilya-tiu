import type { Metadata } from "next";
import { RulebookPageView } from "@/components/public/rulebook-page-view";
import { Container } from "@/components/ui/card";
import { getConferenceDocLinks } from "@/lib/data";

export const metadata: Metadata = {
  title: "Rulebook & guidelines",
  description: "Conference rules of procedure and delegate guidelines for Kautilya.",
};

export default async function RulebookPage() {
  const links = await getConferenceDocLinks();

  return (
    <Container className="py-12 sm:py-16">
      <RulebookPageView links={links} />
    </Container>
  );
}
