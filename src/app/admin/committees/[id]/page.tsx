import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { DelegationMatrix, PortfolioUploadForm } from "@/components/admin/delegation-matrix";
import { CommitteeForm } from "@/components/admin/forms";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getAllEditionsAdmin, getCommitteeById, getCommitteeDelegates } from "@/lib/data";
import { canDownloadCommitteeAllocations } from "@/lib/reports";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Edit committee" };

export default async function EditCommitteePage({ params }: Props) {
  const { id } = await params;
  const [committee, editions, delegates] = await Promise.all([
    getCommitteeById(id),
    getAllEditionsAdmin(),
    getCommitteeDelegates(id),
  ]);
  if (!committee) notFound();
  const canDownload = await canDownloadCommitteeAllocations(committee.edition_id);
  const canEdit = await hasPermission("committee.manage", committee.edition_id);

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Admin"
        title={committee.name}
        description={`${committee.portfolio_config.length} delegations in this committee. Allocating a portfolio does not issue a new QR.`}
      />
      <AdminNav current="/admin/committees" />
      {canDownload ? (
        <p className="mb-6">
          <a
            href={`/admin/reports/committee/${committee.id}`}
            className="inline-flex h-10 items-center rounded-sm border border-gold-700/50 px-4 text-sm font-medium text-gold-700 hover:bg-parchment-200"
          >
            Download delegations
          </a>
        </p>
      ) : null}
      <Card>
        <CommitteeForm editions={editions} committee={committee} />
      </Card>
      {canEdit ? (
        <>
          <Card className="mt-6">
            <p className="font-serif text-2xl text-gold-700">Portfolio matrix</p>
            <p className="mt-2 text-sm text-ink-muted">
              Excel columns are SLR No. and Portfolio. Delegation count is the number of rows.
            </p>
            <div className="mt-4">
              <PortfolioUploadForm committeeId={committee.id} />
            </div>
          </Card>
          <Card className="mt-6">
            <p className="font-serif text-2xl text-gold-700">Allocate delegations</p>
            <p className="mt-2 mb-4 text-sm text-ink-muted">
              Assign a confirmed or registered delegate to each SLR. Scan desks read the live allocation without
              regenerating credentials.
            </p>
            <DelegationMatrix
              committeeId={committee.id}
              portfolios={committee.portfolio_config}
              delegates={delegates}
            />
          </Card>
        </>
      ) : null}
    </Container>
  );
}
