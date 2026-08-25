import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { CreateEditorForm, EditorList } from "@/components/admin/editor-forms";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getEditorAssignments } from "@/lib/data";

export const metadata: Metadata = { title: "Editors" };

export default async function AdminEditorsPage() {
  const allowed = await hasPermission("users.manage");
  if (!allowed) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Content editors"
          description="You need users.manage to create editor logins."
        />
      </Container>
    );
  }

  const rows = await getEditorAssignments();

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Staff"
        title="Content editors"
        description="Create a name, email, and password. They can edit public site copy and committee details. Current passwords stay visible on this list."
      />
      <AdminNav current="/admin/editors" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <p className="mb-4 font-serif text-2xl text-gold-700">Add editor</p>
          <CreateEditorForm />
        </Card>
        <Card>
          <p className="mb-4 font-serif text-2xl text-gold-700">Current editors</p>
          <EditorList rows={rows} />
        </Card>
      </div>
    </Container>
  );
}
