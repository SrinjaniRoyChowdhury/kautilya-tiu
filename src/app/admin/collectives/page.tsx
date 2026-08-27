import type { Metadata } from "next";
import {
  CollectiveList,
  CreateCollectiveForm,
  CreateInstitutionForm,
  InstitutionList,
} from "@/components/admin/collective-forms";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getRoleNames, hasPermission } from "@/lib/auth";
import { getCollectives, getInstitutions } from "@/lib/data";
import { isLimitedStaff } from "@/lib/staff-access";

export const metadata: Metadata = { title: "Collectives" };

export default async function AdminCollectivesPage() {
  const canEdit = await hasPermission("edition.manage");
  const readOnly = !canEdit;
  if (!canEdit && !isLimitedStaff(await getRoleNames())) {
    return (
      <Container className="py-12">
        <PageHeader eyebrow="Staff" title="Collectives" description="Staff only." />
      </Container>
    );
  }

  const [collectives, institutions] = await Promise.all([getCollectives(), getInstitutions()]);

  return (
    <Container className="py-8">
      <PageHeader
        title="Collectives and institutions"
        description="Suggested names for registration. Delegates type to filter these lists. They can still enter an institution that is not on the list."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {canEdit ? (
          <Card>
            <p className="mb-4 font-serif text-2xl text-gold-700">Add collective</p>
            <CreateCollectiveForm />
          </Card>
        ) : null}
        <Card>
          <p className="mb-4 font-serif text-2xl text-gold-700">Current collectives</p>
          <CollectiveList rows={collectives} readOnly={readOnly} />
        </Card>
        {canEdit ? (
          <Card>
            <p className="mb-4 font-serif text-2xl text-gold-700">Add institution</p>
            <CreateInstitutionForm />
          </Card>
        ) : null}
        <Card>
          <p className="mb-4 font-serif text-2xl text-gold-700">Current institutions</p>
          <InstitutionList rows={institutions} readOnly={readOnly} />
        </Card>
      </div>
    </Container>
  );
}
