"use client";

import { useActionState } from "react";
import {
  createCollectiveAction,
  deleteCollectiveAction,
  updateCollectiveAction,
  type CollectiveState,
} from "@/app/actions/collectives";
import {
  createInstitutionAction,
  deleteInstitutionAction,
  updateInstitutionAction,
  type InstitutionState,
} from "@/app/actions/institutions";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import type { Collective, Institution } from "@/types";

export function CreateCollectiveForm() {
  const [state, action, pending] = useActionState(createCollectiveAction, {} as CollectiveState);
  return (
    <form action={action} className="grid gap-3">
      <Field label="Collective name" htmlFor="collective_name">
        <Input id="collective_name" name="name" required minLength={2} maxLength={80} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add collective"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}

export function CreateInstitutionForm() {
  const [state, action, pending] = useActionState(createInstitutionAction, {} as InstitutionState);
  return (
    <form action={action} className="grid gap-3">
      <Field label="Institution name" htmlFor="institution_name">
        <Input id="institution_name" name="name" required minLength={2} maxLength={120} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add institution"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}

export function CollectiveList({ rows, readOnly = false }: { rows: Collective[]; readOnly?: boolean }) {
  return (
    <NamedList
      rows={rows}
      readOnly={readOnly}
      empty="No collectives yet."
      update={updateCollectiveAction}
      remove={deleteCollectiveAction}
    />
  );
}

export function InstitutionList({ rows, readOnly = false }: { rows: Institution[]; readOnly?: boolean }) {
  return (
    <NamedList
      rows={rows}
      readOnly={readOnly}
      empty="No institutions yet."
      update={updateInstitutionAction}
      remove={deleteInstitutionAction}
    />
  );
}

type NamedState = CollectiveState | InstitutionState;

function NamedList({
  rows,
  readOnly,
  empty,
  update,
  remove,
}: {
  rows: Array<{ id: string; name: string }>;
  readOnly: boolean;
  empty: string;
  update: (id: string, prev: NamedState, formData: FormData) => Promise<NamedState>;
  remove: (id: string, prev: NamedState, formData: FormData) => Promise<NamedState>;
}) {
  if (!rows.length) {
    return <p className="text-sm text-ink-muted">{empty}</p>;
  }
  if (readOnly) {
    return (
      <ul className="grid gap-2 text-sm">
        {rows.map((row) => (
          <li key={row.id}>{row.name}</li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid gap-4">
      {rows.map((row) => (
        <li key={row.id} className="border-b border-gold-700/15 pb-4 last:border-b-0 last:pb-0">
          <EditNamedForm row={row} update={update} remove={remove} />
        </li>
      ))}
    </ul>
  );
}

function EditNamedForm({
  row,
  update,
  remove,
}: {
  row: { id: string; name: string };
  update: (id: string, prev: NamedState, formData: FormData) => Promise<NamedState>;
  remove: (id: string, prev: NamedState, formData: FormData) => Promise<NamedState>;
}) {
  const save = update.bind(null, row.id);
  const drop = remove.bind(null, row.id);
  const [state, action, pending] = useActionState(save, {} as NamedState);
  const [deleteState, deleteAction, deleting] = useActionState(drop, {} as NamedState);
  return (
    <div className="grid gap-2">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <Field label="Name" htmlFor={`name-${row.id}`}>
            <Input id={`name-${row.id}`} name="name" defaultValue={row.name} required />
          </Field>
        </div>
        <Button type="submit" size="sm" disabled={pending || deleting}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <ActionFeedback error={state.error} success={state.success} className="w-full text-xs" />
      </form>
      <form action={deleteAction}>
        <Button type="submit" variant="ghost" size="sm" disabled={pending || deleting}>
          {deleting ? "Removing…" : "Delete"}
        </Button>
        <ActionFeedback error={deleteState.error} success={deleteState.success} className="text-xs" />
      </form>
    </div>
  );
}
