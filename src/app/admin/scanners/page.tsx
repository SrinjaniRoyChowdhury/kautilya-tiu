import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { CreateScannerForm, ScannerList } from "@/components/admin/scanner-forms";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getAllEditionsAdmin, getScannerAssignments } from "@/lib/data";

export const metadata: Metadata = { title: "Scanners" };

export default async function AdminScannersPage() {
  const allowed = await hasPermission("users.manage");
  if (!allowed) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Scanners"
          description="You need users.manage to create desk scanner logins."
        />
      </Container>
    );
  }

  const [editions, rows] = await Promise.all([getAllEditionsAdmin(), getScannerAssignments()]);

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Staff"
        title="Desk scanners"
        description="Create a name, email, and password. That person signs in and opens Scan — delegates cannot. Use a laptop webcam now; phones can scan later."
      />
      <AdminNav current="/admin/scanners" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <p className="mb-4 font-serif text-2xl text-gold-700">Add scanner</p>
          <CreateScannerForm editions={editions} />
        </Card>
        <Card>
          <p className="mb-4 font-serif text-2xl text-gold-700">Current scanners</p>
          <ScannerList rows={rows} />
        </Card>
      </div>
    </Container>
  );
}
