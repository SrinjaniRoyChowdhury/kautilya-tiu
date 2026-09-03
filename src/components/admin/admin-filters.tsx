import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function AdminListShell({
  header,
  toolbar,
  footer,
  children,
}: {
  header: ReactNode;
  toolbar: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#faf6ee]">
      <div className="shrink-0 border-b border-gold-700/20 bg-parchment-50 px-4 py-3 sm:px-6">
        <div className="mb-2">{header}</div>
        <div className="space-y-2">{toolbar}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#faf6ee] px-4 py-3 sm:px-6">{children}</div>
      {footer ? (
        <div className="shrink-0 border-t border-gold-700/20 bg-parchment-50 px-4 py-2 sm:px-6">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function AdminFilters({
  action,
  q,
  qPlaceholder = "Search name or email",
  children,
}: {
  action: string;
  q?: string;
  qPlaceholder?: string;
  children?: ReactNode;
}) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-2">
      <div className="min-w-[12rem] flex-1">
        <Field label="Search" htmlFor="q">
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder={qPlaceholder} className="h-9 py-1.5" />
        </Field>
      </div>
      {children}
      <Button type="submit" variant="secondary" size="sm">
        Apply
      </Button>
    </form>
  );
}

export function AdminPagination({
  page,
  pageCount,
  total,
  from,
  to,
  makeHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  makeHref: (page: number) => string;
}) {
  if (total === 0) return null;
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <p className="text-ink-muted">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-3">
        {page > 1 ? (
          <Link href={makeHref(page - 1)} className="text-gold-700 hover:underline">
            Previous
          </Link>
        ) : (
          <span className="text-ink-muted">Previous</span>
        )}
        <span className="text-ink-muted">
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <Link href={makeHref(page + 1)} className="text-gold-700 hover:underline">
            Next
          </Link>
        ) : (
          <span className="text-ink-muted">Next</span>
        )}
      </div>
    </nav>
  );
}

export function AdminTable({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
      <thead className="sticky top-0 z-10 bg-parchment-50">
        <tr className="border-b border-gold-700/25 text-xs uppercase tracking-wide text-gold-700">
          {columns.map((column) => (
            <th key={column || "actions"} className="px-2 py-1.5 font-medium">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
