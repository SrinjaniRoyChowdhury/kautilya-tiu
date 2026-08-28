import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserCredentialsForm } from "@/components/admin/user-forms";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getAdminUser } from "@/lib/data";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = { title: "User" };

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const canView = await hasPermission("registration.view");
  if (!canView) {
    return (
      <Container className="py-12">
        <PageHeader eyebrow="Staff" title="User" description="You need registration.view." />
      </Container>
    );
  }

  const user = await getAdminUser(id);
  if (!user) notFound();
  const canEdit = await hasPermission("registration.edit");

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Staff"
        title={user.full_name}
        description={`${user.email}${user.phone ? ` · ${user.phone}` : ""}`}
      />
      <p className="mb-6">
        <Link href="/admin/users" className="text-sm text-gold-700 hover:underline">
          Back to users
        </Link>
        {user.registration_id ? (
          <>
            {" · "}
            <Link href={`/admin/participants/${user.registration_id}`} className="text-sm text-gold-700 hover:underline">
              Open registration
            </Link>
          </>
        ) : null}
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <p className="mb-2 font-serif text-2xl text-gold-700">Account</p>
          <p className="text-sm text-ink-muted">
            {user.email_verified_at ? "Email verified" : "Email not verified"}
            {user.registration_status ? ` · registration ${user.registration_status.toLowerCase()}` : " · no registration yet"}
          </p>
        </Card>
        {canEdit ? (
          <Card>
            <p className="mb-4 font-serif text-2xl text-gold-700">Credentials</p>
            <UserCredentialsForm user={user} />
          </Card>
        ) : (
          <Card>
            <p className="mb-2 font-serif text-2xl text-gold-700">Credentials</p>
            <p className="text-sm text-ink-muted">You can view this account. Editing needs registration.edit.</p>
          </Card>
        )}
      </div>
    </Container>
  );
}
