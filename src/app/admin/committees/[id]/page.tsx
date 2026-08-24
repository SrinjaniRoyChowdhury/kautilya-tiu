import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommitteeForm } from "@/components/admin/forms";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getAllEditionsAdmin, getCommitteeById } from "@/lib/data";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Edit committee" };

export default async function EditCommitteePage({ params }: Props) {
  const { id } = await params;
  const [committee, editions] = await Promise.all([getCommitteeById(id), getAllEditionsAdmin()]);
  if (!committee) notFound();

  return (
    <Container className="py-12">
      <PageHeader eyebrow="Admin" title={committee.name} />
      <AdminNav current="/admin/committees" />
      <Card>
        <CommitteeForm editions={editions} committee={committee} />
      </Card>
    </Container>
  );
}
