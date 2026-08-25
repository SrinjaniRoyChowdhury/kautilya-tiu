import type { ReactNode } from "react";
import Link from "next/link";
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
    <Container className="py-6">
      <div className="mb-3">{header}</div>
      <div className="mb-4 space-y-2">{toolbar}</div>
      {children}
      {footer ? <div className="mt-6">{footer}</div> : null}
    </Container>
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
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder={qPlaceholder} />
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
