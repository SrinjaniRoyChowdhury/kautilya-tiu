import type { Metadata } from "next";
import { EditionsPageView } from "@/components/public/editions-page-view";
import { Container } from "@/components/ui/card";
import { getPublicEditions } from "@/lib/data";

export const metadata: Metadata = { title: "Editions" };

export default async function EditionsPage() {
  const editions = await getPublicEditions();
  return (
    <Container className="py-12">
      <EditionsPageView editions={editions} />
    </Container>
  );
}
