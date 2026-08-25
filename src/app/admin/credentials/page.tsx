import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { RegenerateQrForm } from "@/components/admin/regenerate-qr-form";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getAllEditionsAdmin, getConfirmedCredentials } from "@/lib/data";

export const metadata: Metadata = { title: "Credentials" };

export default async function AdminCredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const { edition: editionId } = await searchParams;
  const allowed = await hasPermission("registration.view");
  if (!allowed) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Credentials"
          description="You need registration.view to list confirmed delegates."
        />
      </Container>
    );
  }

  const [editions, rows, canRegenerate] = await Promise.all([
    getAllEditionsAdmin(),
    getConfirmedCredentials(editionId || null),
    hasPermission("qr.regenerate"),
  ]);

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Staff"
        title="Credentials"
        description="Confirmed delegates. Regenerating revokes the previous QR immediately."
      />
      <AdminNav current="/admin/credentials" />
      {editions.length > 1 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link href="/admin/credentials" className="text-sm text-gold-700 hover:underline">
            All editions
          </Link>
          {editions.map((edition) => (
            <Link
              key={edition.id}
              href={`/admin/credentials?edition=${edition.id}`}
              className="text-sm text-gold-700 hover:underline"
            >
              {edition.name}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3">
        {rows.length ? (
          rows.map((row) => (
            <Card key={row.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-serif text-xl">{row.full_name}</p>
                  <p className="text-sm text-ink-muted">
                    {row.email}
                    {row.committee_short_name ? ` · ${row.committee_short_name}` : ""}
                    {row.food_preference ? ` · ${row.food_preference}` : ""}
                  </p>
                  <p className="mt-2 font-mono text-lg tracking-widest">
                    {row.display_code ?? "No active QR"}
                  </p>
                </div>
                {canRegenerate ? <RegenerateQrForm registrationId={row.id} /> : null}
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-ink-muted">No confirmed registrations yet.</p>
          </Card>
        )}
      </div>
    </Container>
  );
}
