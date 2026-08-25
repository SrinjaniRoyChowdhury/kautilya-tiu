"use client";

import { useActionState } from "react";
import {
  deleteConferenceDocAction,
  uploadConferenceDocAction,
  type DocsState,
} from "@/app/actions/docs";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { DOC_LABELS, type DocKind } from "@/lib/docs";
import type { ConferenceDocument } from "@/types";

export function ConferenceDocForm() {
  const [state, action, pending] = useActionState(uploadConferenceDocAction, {} as DocsState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
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
      <Field label="Document" htmlFor="kind">
        <Select id="kind" name="kind" defaultValue="rulebook" required>
          <option value="rulebook">Rulebook</option>
          <option value="guidelines">Guidelines</option>
        </Select>
      </Field>
      <Field label="PDF" htmlFor="file" hint="PDF only, max 12 MB.">
        <Input id="file" name="file" type="file" accept="application/pdf" required />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Publishing…" : "Upload PDF"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteConferenceDocButton({ kind }: { kind: DocKind }) {
  const [state, action, pending] = useActionState(deleteConferenceDocAction, {} as DocsState);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="kind" value={kind} />
      {state.error ? (
        <p className="mb-2 text-xs text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Removing…" : `Delete ${DOC_LABELS[kind]}`}
      </Button>
    </form>
  );
}

export function PublishedDocs({ docs }: { docs: ConferenceDocument[] }) {
  if (!docs.length) {
    return <p className="text-sm text-ink-muted">No PDFs published yet.</p>;
  }
  return (
    <ul className="mt-4 grid gap-3">
      {docs.map((doc) => (
        <li key={doc.kind} className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>
            {DOC_LABELS[doc.kind]} · {doc.file_name}
          </span>
          <DeleteConferenceDocButton kind={doc.kind} />
        </li>
      ))}
    </ul>
  );
}
