import type { Metadata } from "next";
import { EditionForm } from "@/components/admin/forms";
import { Card, Container, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "New edition" };

export default function NewEditionPage() {
  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Admin"
        title="New edition"
        description="Creates default registration fields and a 3-day meal schedule so later phases have something to attach to."
      />
      <Card>
        <EditionForm />
      </Card>
    </Container>
  );
}
