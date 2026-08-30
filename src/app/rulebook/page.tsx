import type { Metadata } from "next";
import { RulebookPageView } from "@/components/public/rulebook-page-view";
import { Container } from "@/components/ui/card";
import { getConferenceDocuments } from "@/lib/data";

export const metadata: Metadata = {
  title: "Rulebook & guidelines",
  description: "Conference rules of procedure and delegate guidelines for Niti Sabha.",
};

export default async function RulebookPage() {
  const docs = await getConferenceDocuments();
  const published = {
    rulebook: docs.some((doc) => doc.kind === "rulebook"),
    guidelines: docs.some((doc) => doc.kind === "guidelines"),
  };

  return (
    <Container className="py-12 sm:py-16">
      <RulebookPageView published={published} />
    </Container>
  );
}
