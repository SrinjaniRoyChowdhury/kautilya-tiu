"use client";

import { useActionState } from "react";
import Link from "next/link";
import { assignDelegationAction, uploadCommitteePortfoliosAction, type FormState } from "@/app/actions/committees";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { CommitteeDelegate, Portfolio } from "@/types";

export function PortfolioUploadForm({ committeeId }: { committeeId: string }) {
  const action = uploadCommitteePortfoliosAction.bind(null, committeeId);
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      {state.error ? (
        <p className="sm:col-span-2 rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="sm:col-span-2 rounded-sm bg-parchment-200 px-3 py-2 text-sm" role="status">
          {state.success}
        </p>
      ) : null}
      <Field label="Upload portfolio Excel" htmlFor="matrix-file" hint="SLR No. and Portfolio columns. Delegation count is the row count.">
        <Input id="matrix-file" name="portfolio_file" type="file" accept=".xlsx,.xls,.csv,text/csv" required />
      </Field>
      <div className="flex flex-wrap items-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload matrix"}
        </Button>
        <Link href="/admin/committees/portfolio-template" prefetch={false} className="mb-2 text-sm text-gold-700 hover:underline">
          Download empty template
        </Link>
      </div>
    </form>
  );
}

export function DelegationMatrix({
  committeeId,
  portfolios,
  delegates,
}: {
  committeeId: string;
  portfolios: Portfolio[];
  delegates: CommitteeDelegate[];
}) {
  if (!portfolios.length) {
    return <p className="text-sm text-ink-muted">Upload a portfolio matrix to allocate delegations.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead>
          <tr className="border-b border-gold-700/20 text-xs uppercase tracking-[0.16em] text-gold-700">
            <th className="py-2 pr-3 font-medium">SLR No.</th>
            <th className="py-2 pr-3 font-medium">Portfolio</th>
            <th className="py-2 font-medium">Delegate</th>
          </tr>
        </thead>
        <tbody>
          {portfolios.map((row) => {
            const slr = row.slr ?? 0;
            const assigned = delegates.find((item) => item.allocated_slr === slr);
            return (
              <tr key={`${slr}-${row.name}`} className="border-b border-gold-700/10">
                <td className="py-2 pr-3 font-mono">{slr || "—"}</td>
                <td className="py-2 pr-3">{row.name}</td>
                <td className="py-2">
                  <AssignRow
                    committeeId={committeeId}
                    slr={slr}
                    portfolio={row.name}
                    currentId={assigned?.id ?? ""}
                    delegates={delegates}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AssignRow({
  committeeId,
  slr,
  portfolio,
  currentId,
  delegates,
}: {
  committeeId: string;
  slr: number;
  portfolio: string;
  currentId: string;
  delegates: CommitteeDelegate[];
}) {
  const action = assignDelegationAction.bind(null, committeeId);
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="slr" value={slr} />
      <input type="hidden" name="portfolio" value={portfolio} />
      <Select name="registration_id" defaultValue={currentId} className="min-w-56">
        <option value="">Unassigned</option>
        {delegates.map((delegate) => (
          <option key={delegate.id} value={delegate.id}>
            {delegate.full_name}
            {delegate.allocated_slr && delegate.allocated_slr !== slr ? ` (now ${delegate.allocated_slr})` : ""}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="secondary" size="sm" disabled={pending || slr < 1}>
        {pending ? "Saving…" : "Assign"}
      </Button>
      {state.error ? <span className="text-xs text-red-800">{state.error}</span> : null}
      {state.success ? <span className="text-xs text-ink-muted">{state.success}</span> : null}
    </form>
  );
}
