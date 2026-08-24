import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getAllEditionsAdmin, getCommitteesForEdition } from "@/lib/data";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHomePage() {
  const editions = await getAllEditionsAdmin();
  const active = editions.find((e) => e.is_public_active) ?? editions[0];
  const committees = active ? await getCommitteesForEdition(active.id) : [];
  const extraActive = editions.filter((e) => e.is_public_active).length > 1;

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Staff"
        title="Admin portal"
        description="Phase 1: editions and committees. Payments, QR, and scanners arrive in later phases."
      />
      <AdminNav current="/admin" />
      {extraActive ? (
        <p className="mb-6 rounded-sm bg-parchment-200 px-3 py-2 text-sm" role="status">
          More than one edition is flagged public-active. The public site will still work; pick one
          flag so the CTA is unambiguous (FR-EDIT-003).
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-widest text-gold-700">Editions</p>
          <p className="mt-2 font-serif text-4xl text-gold-700">{editions.length}</p>
          <Link href="/admin/editions" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
            Manage
          </Link>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gold-700">Committees</p>
          <p className="mt-2 font-serif text-4xl text-gold-700">{committees.length}</p>
          <p className="mt-1 text-xs text-ink-muted">{active?.name ?? "No edition"}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gold-700">Public active</p>
          <p className="mt-2 font-serif text-2xl">{active?.name ?? "—"}</p>
        </Card>
      </div>
    </Container>
  );
}
