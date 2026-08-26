import type { Metadata } from "next";
import { CollectiveList, CreateCollectiveForm } from "@/components/admin/collective-forms";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { isStaffUser } from "@/lib/auth";
import { getCollectives } from "@/lib/data";

export const metadata: Metadata = { title: "Collectives" };

export default async function AdminCollectivesPage() {
  const staff = await isStaffUser();
  if (!staff) {
    return (
      <Container className="py-12">
        <PageHeader eyebrow="Staff" title="Collectives" description="Staff only." />
      </Container>
    );
  }

  const rows = await getCollectives();

  return (
    <Container className="py-8">
      <PageHeader
        title="Collectives"
        description="Named groups such as a school contingent. Delegates can pick one while registering. Institution becomes optional if they belong to a collective."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <p className="mb-4 font-serif text-2xl text-gold-700">Add collective</p>
          <CreateCollectiveForm />
        </Card>
        <Card>
          <p className="mb-4 font-serif text-2xl text-gold-700">Current collectives</p>
          <CollectiveList rows={rows} />
        </Card>
      </div>
    </Container>
  );
}
