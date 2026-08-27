import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EditionForm } from "@/components/admin/forms";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";

export const metadata: Metadata = { title: "New edition" };

export default async function NewEditionPage() {
  if (!(await hasPermission("edition.manage"))) redirect("/admin/editions");
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
