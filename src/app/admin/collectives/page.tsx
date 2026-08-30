import type { Metadata } from "next";
import {
  CollectiveTable,
  CreateCollectiveModalButton,
  CreateInstitutionModalButton,
  InstitutionTable,
} from "@/components/admin/collective-forms";
import { AdminFilters, AdminListShell, AdminPagination } from "@/components/admin/admin-filters";
import { Container, PageHeader } from "@/components/ui/card";
import { getRoleNames, hasPermission } from "@/lib/auth";
import { getActiveEdition, getCollectives, getInstitutions } from "@/lib/data";
import { adminListHref, matchesQuery, paginate, parsePage } from "@/lib/search";
import { isLimitedStaff } from "@/lib/staff-access";

export const metadata: Metadata = { title: "Collectives" };

export default async function AdminCollectivesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const { tab = "collectives", q = "", page: pageRaw } = await searchParams;
  const canEdit = await hasPermission("edition.manage");
  const readOnly = !canEdit;
  if (!canEdit && !isLimitedStaff(await getRoleNames())) {
    return (
      <Container className="py-12">
        <PageHeader eyebrow="Staff" title="Collectives" description="Staff only." />
      </Container>
    );
  }

  const [collectives, institutions, edition] = await Promise.all([
    getCollectives(),
    getInstitutions(),
    getActiveEdition(),
  ]);
  const editionId = edition?.id ?? "";
  const onCollectives = tab !== "institutions";
  const source = onCollectives ? collectives : institutions;
  const visible = source.filter((row) => matchesQuery(q, row.name));
  const paged = paginate(visible, parsePage(pageRaw));
  const query = { tab, q };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Container className="shrink-0 py-6">
        <PageHeader
          title="Collectives and institutions"
          description="Suggested names for registration. Delegates can still enter a name that is not on the list."
        />
      </Container>
      <AdminListShell
        header={
          <div className="flex flex-wrap gap-3">
            <a
              href={adminListHref("/admin/collectives", { tab: "collectives", q }, 1)}
              className={onCollectives ? "font-semibold text-gold-700" : "text-gold-700 hover:underline"}
            >
              Collectives
            </a>
            <a
              href={adminListHref("/admin/collectives", { tab: "institutions", q }, 1)}
              className={!onCollectives ? "font-semibold text-gold-700" : "text-gold-700 hover:underline"}
            >
              Institutions
            </a>
          </div>
        }
        toolbar={
          <>
            {canEdit ? (
              onCollectives ? <CreateCollectiveModalButton /> : <CreateInstitutionModalButton />
            ) : null}
            <AdminFilters action="/admin/collectives" q={q} qPlaceholder="Search name">
              <input type="hidden" name="tab" value={tab} />
            </AdminFilters>
          </>
        }
        footer={
          <AdminPagination
            page={paged.page}
            pageCount={paged.pageCount}
            total={paged.total}
            from={paged.from}
            to={paged.to}
            makeHref={(next) => adminListHref("/admin/collectives", query, next)}
          />
        }
      >
        {onCollectives ? (
          <CollectiveTable
            rows={paged.items as typeof collectives}
            readOnly={readOnly}
            editionId={editionId}
          />
        ) : (
          <InstitutionTable
            rows={paged.items as typeof institutions}
            readOnly={readOnly}
            editionId={editionId}
          />
        )}
      </AdminListShell>
    </div>
  );
}
