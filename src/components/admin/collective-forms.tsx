"use client";

import { useActionState } from "react";
import {
  createCollectiveAction,
  deleteCollectiveAction,
  updateCollectiveAction,
  type CollectiveState,
} from "@/app/actions/collectives";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import type { Collective } from "@/types";

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

export function CollectiveList({ rows, readOnly = false }: { rows: Collective[]; readOnly?: boolean }) {
  if (!rows.length) {
    return <p className="text-sm text-ink-muted">No collectives yet.</p>;
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
          <EditCollectiveForm collective={row} />
        </li>
      ))}
    </ul>
  );
}

function EditCollectiveForm({ collective }: { collective: Collective }) {
  const update = updateCollectiveAction.bind(null, collective.id);
  const remove = deleteCollectiveAction.bind(null, collective.id);
  const [state, action, pending] = useActionState(update, {} as CollectiveState);
  const [deleteState, deleteAction, deleting] = useActionState(remove, {} as CollectiveState);
  return (
    <div className="grid gap-2">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <Field label="Name" htmlFor={`name-${collective.id}`}>
            <Input id={`name-${collective.id}`} name="name" defaultValue={collective.name} required />
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
