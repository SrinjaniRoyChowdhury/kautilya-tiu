import Link from "next/link";
import { AccountRowActions } from "@/components/admin/account-forms";
import { CreateAccountModalButton } from "@/components/admin/account-modal";
import { AdminFilters, AdminListShell, AdminPagination, AdminTable } from "@/components/admin/admin-filters";
import { Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { getAllEditionsAdmin, getManagedStaffAccounts } from "@/lib/data";
import { cn } from "@/lib/format";
import { adminListHref, matchesQuery, paginate, parsePage } from "@/lib/search";
import { ACCOUNT_KIND_LABELS, ACCOUNT_KINDS, type AccountKind } from "@/lib/username";

function isAccountKind(value: string | undefined): value is AccountKind {
  return Boolean(value && (ACCOUNT_KINDS as readonly string[]).includes(value));
}

function detailsFor(account: Awaited<ReturnType<typeof getManagedStaffAccounts>>[number]) {
  if (account.kind !== "scanner") return "—";
  const desk =
    account.desk === "food" ? "Food" : account.desk === "attendance" ? "Attendance" : "Attendance + food";
  return `${desk} · ${account.edition_name ?? "All editions"}`;
}

export async function StaffAccountsList({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; page?: string }>;
}) {
  const { q = "", kind: kindRaw, page: pageRaw } = await searchParams;
  const kind = isAccountKind(kindRaw) ? kindRaw : undefined;
  const allowed = await hasPermission("users.manage");
  if (!allowed) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Accounts"
          description="You need users.manage to create scanner, editor, delegate affairs, and viewer logins."
        />
      </Container>
    );
  }

  const [editions, rows] = await Promise.all([getAllEditionsAdmin(), getManagedStaffAccounts()]);
  const visible = rows.filter((row) => {
    if (kind && row.kind !== kind) return false;
    return matchesQuery(q, row.full_name, row.username, row.email, ACCOUNT_KIND_LABELS[row.kind]);
  });
  const paged = paginate(visible, parsePage(pageRaw));
  const query = { q, kind };
  const addLabel = kind ? `Add ${ACCOUNT_KIND_LABELS[kind].toLowerCase()}` : "Add account";

  return (
    <AdminListShell
      header={
        <h1 className="font-serif text-xl text-gold-700">
          Accounts{kind ? ` · ${ACCOUNT_KIND_LABELS[kind]}` : ""}
        </h1>
      }
      footer={
        <AdminPagination
          page={paged.page}
          pageCount={paged.pageCount}
          total={paged.total}
          from={paged.from}
          to={paged.to}
          makeHref={(next) => adminListHref("/admin/accounts", query, next)}
        />
      }
      toolbar={
        <>
          <CreateAccountModalButton editions={editions} defaultKind={kind} label={addLabel} />
          <div className="flex flex-wrap gap-2">
            <Link
              href={adminListHref("/admin/accounts", { q }, 1)}
              className={cn("text-sm", !kind ? "font-semibold text-gold-700" : "text-gold-700 hover:underline")}
            >
              All types
            </Link>
            {ACCOUNT_KINDS.map((item) => (
              <Link
                key={item}
                href={adminListHref("/admin/accounts", { q, kind: item }, 1)}
                className={cn(
                  "text-sm",
                  kind === item ? "font-semibold text-gold-700" : "text-gold-700 hover:underline",
                )}
              >
                {ACCOUNT_KIND_LABELS[item]}
              </Link>
            ))}
          </div>
          <AdminFilters action="/admin/accounts" q={q} qPlaceholder="Search name or username">
            {kind ? <input type="hidden" name="kind" value={kind} className="hidden" /> : null}
          </AdminFilters>
        </>
      }
    >
      {paged.items.length ? (
        <AdminTable columns={["Name", "Username", "Password", "Type", "Details", ""]}>
          {paged.items.map((row) => (
            <tr key={row.user_id} className="border-b border-gold-700/10 hover:bg-parchment-100">
              <td className="px-2 py-1.5 font-medium">{row.full_name}</td>
              <td className="px-2 py-1.5 font-mono text-ink-muted">{row.username ?? "—"}</td>
              <td className="px-2 py-1.5 font-mono text-ink-muted">{row.password_plain ?? "—"}</td>
              <td className="px-2 py-1.5 text-ink-muted">{ACCOUNT_KIND_LABELS[row.kind]}</td>
              <td className="px-2 py-1.5 text-ink-muted">{detailsFor(row)}</td>
              <td className="px-2 py-1.5 text-right">
                <AccountRowActions account={row} editions={editions} />
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <p className="text-sm text-ink-muted">No accounts match this search.</p>
      )}
    </AdminListShell>
  );
}
