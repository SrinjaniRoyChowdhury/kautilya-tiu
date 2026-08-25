import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getAuditLogs } from "@/lib/data";

export const metadata: Metadata = { title: "Audit log" };

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminAuditPage() {
  const allowed = await hasPermission("audit.view");
  if (!allowed) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Audit log"
          description="You need audit.view to read secretariat actions."
        />
      </Container>
    );
  }

  const rows = await getAuditLogs(100);

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Staff"
        title="Audit log"
        description="Latest 100 writes: payments, QR, attendance, CMS, editions."
      />
      <AdminNav current="/admin/audit" />
      <div className="grid gap-3">
        {rows.length ? (
          rows.map((row) => (
            <Card key={row.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-gold-700">{row.action}</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {row.entity}
                    {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ""}
                  </p>
                  <p className="mt-1 text-sm">
                    {row.actor_name ?? "System"}
                    {row.actor_email ? ` · ${row.actor_email}` : ""}
                  </p>
                </div>
                <p className="text-xs text-ink-muted">{formatWhen(row.created_at)}</p>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-ink-muted">No audit rows yet.</p>
          </Card>
        )}
      </div>
    </Container>
  );
}
