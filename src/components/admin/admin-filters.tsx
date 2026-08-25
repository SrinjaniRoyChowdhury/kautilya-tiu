import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/card";
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
    <div className="fixed inset-x-0 bottom-0 top-[var(--site-header-height)] z-20 flex flex-col overflow-hidden bg-parchment-50">
      <div className="shrink-0 border-b border-gold-700/20 bg-parchment-50">
        <Container className="space-y-3 py-3">
          {header}
          {toolbar}
        </Container>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Container className="py-4">{children}</Container>
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-gold-700/20 bg-parchment-50">
          <Container className="py-3">{footer}</Container>
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
    <form method="get" action={action} className="grid gap-3 md:grid-cols-4 md:items-end">
      <Field label="Search" htmlFor="q">
        <Input id="q" name="q" defaultValue={q ?? ""} placeholder={qPlaceholder} />
      </Field>
      {children}
      <Button type="submit" variant="secondary">
        Apply filters
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
          <a href={makeHref(page - 1)} className="text-gold-700 hover:underline">
            Previous
          </a>
        ) : (
          <span className="text-ink-muted">Previous</span>
        )}
        <span className="text-ink-muted">
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <a href={makeHref(page + 1)} className="text-gold-700 hover:underline">
            Next
          </a>
        ) : (
          <span className="text-ink-muted">Next</span>
        )}
      </div>
    </nav>
  );
}
