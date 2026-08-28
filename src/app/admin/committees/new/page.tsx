import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommitteeForm } from "@/components/admin/forms";
import { BackLink } from "@/components/ui/back-link";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getAllEditionsAdmin } from "@/lib/data";

export const metadata: Metadata = { title: "New committee" };

export default async function NewCommitteePage() {
  const allowed = await hasPermission("committee.manage");
  if (!allowed) redirect("/admin/committees");
  const editions = await getAllEditionsAdmin();
  const defaultEditionId = editions.find((e) => e.is_public_active)?.id ?? editions[0]?.id;

  return (
    <Container className="py-12">
      <BackLink href="/admin/committees" label="Back to committees" />
      <PageHeader
        eyebrow="Admin"
        title="New committee"
        description="Save the committee first, then upload the portfolio matrix on the next screen."
      />
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
