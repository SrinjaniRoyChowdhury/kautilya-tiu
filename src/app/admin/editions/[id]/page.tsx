import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditionForm } from "@/components/admin/forms";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getEditionById } from "@/lib/data";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Edit edition" };

export default async function EditEditionPage({ params }: Props) {
  const { id } = await params;
  const edition = await getEditionById(id);
  if (!edition) notFound();

  return (
    <Container className="py-12">
      <PageHeader eyebrow="Admin" title={edition.name} />
      <AdminNav current="/admin/editions" />
      <Card>
        <EditionForm edition={edition} />
      </Card>
    </Container>
  );
}
