import type { Metadata } from "next";
import { ConferenceDocCards } from "@/components/public/doc-cards";
import { Container, PageHeader } from "@/components/ui/card";
import { getConferenceDocuments } from "@/lib/data";
import { DOC_KINDS } from "@/lib/docs";

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
      <PageHeader
        eyebrow="Procedure"
        title="Rulebook and guidelines"
        description="Open or download both documents before you register. The secretariat publishes PDFs here; only admins can replace them."
      />
      <ConferenceDocCards published={published} />
      {DOC_KINDS.every((kind) => !published[kind]) ? (
        <p className="mt-6 text-sm text-ink-muted">No files uploaded yet.</p>
      ) : null}
    </Container>
  );
}
