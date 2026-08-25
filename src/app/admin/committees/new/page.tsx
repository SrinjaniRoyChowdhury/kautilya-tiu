import type { Metadata } from "next";
import { CommitteeForm } from "@/components/admin/forms";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getAllEditionsAdmin } from "@/lib/data";

export const metadata: Metadata = { title: "New committee" };

export default async function NewCommitteePage() {
  const editions = await getAllEditionsAdmin();
  const defaultEditionId = editions.find((e) => e.is_public_active)?.id ?? editions[0]?.id;

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Admin"
        title="New committee"
        description="Save the committee first, then upload the portfolio matrix on the next screen."
      />
      <AdminNav current="/admin/committees" />
      <Card>
        {editions.length ? (
          <CommitteeForm editions={editions} defaultEditionId={defaultEditionId} />
        ) : (
          <p className="text-ink-muted">Create an edition first.</p>
        )}
      </Card>
    </Container>
  );
}
