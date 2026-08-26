"use client";

import { useActionState } from "react";
import {
  createExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
  type ExpenseState,
} from "@/app/actions/expenses";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { formatInrFromMinor } from "@/lib/format";
import type { EditionExpense } from "@/types";

export function CreateExpenseForm({ editionId }: { editionId: string }) {
  const [state, action, pending] = useActionState(createExpenseAction, {} as ExpenseState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="edition_id" value={editionId} />
      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" required minLength={2} />
      </Field>
      <Field label="Category" htmlFor="category">
        <Input id="category" name="category" placeholder="Venue, food, print…" />
      </Field>
      <Field label="Amount (₹)" htmlFor="amount_rupees">
        <Input id="amount_rupees" name="amount_rupees" type="number" min={0} step="1" required />
      </Field>
      <Field label="Date" htmlFor="incurred_on">
        <Input id="incurred_on" name="incurred_on" type="date" required />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" name="notes" />
        </Field>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add expense"}
        </Button>
        <ActionFeedback error={state.error} success={state.success} />
      </div>
    </form>
  );
}

export function ExpenseTable({
  rows,
  canEdit,
}: {
  rows: EditionExpense[];
  canEdit: boolean;
}) {
  if (!rows.length) return <p className="text-sm text-ink-muted">No expenses recorded yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-gold-700/25 text-xs uppercase tracking-wide text-gold-700">
            <th className="px-2 py-1.5">Date</th>
            <th className="px-2 py-1.5">Title</th>
            <th className="px-2 py-1.5">Category</th>
            <th className="px-2 py-1.5">Amount</th>
            {canEdit ? <th className="px-2 py-1.5" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gold-700/10 align-top">
              <td className="px-2 py-1.5 whitespace-nowrap">{row.incurred_on}</td>
              <td className="px-2 py-1.5">{row.title}</td>
              <td className="px-2 py-1.5 text-ink-muted">{row.category ?? "—"}</td>
              <td className="px-2 py-1.5">{formatInrFromMinor(row.amount_minor)}</td>
              {canEdit ? (
                <td className="px-2 py-1.5">
                  <EditExpenseForm expense={row} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditExpenseForm({ expense }: { expense: EditionExpense }) {
  const update = updateExpenseAction.bind(null, expense.id);
  const [state, action, pending] = useActionState(update, {} as ExpenseState);
  const [deleteState, deleteAction, deleting] = useActionState(
    async (_prev: ExpenseState, _formData: FormData) => {
      void _prev;
      void _formData;
      return deleteExpenseAction(expense.id, expense.edition_id);
    },
    {} as ExpenseState,
  );
  return (
    <div className="grid gap-2">
      <form action={action} className="flex flex-wrap items-end gap-1">
        <input type="hidden" name="edition_id" value={expense.edition_id} />
        <Input name="title" defaultValue={expense.title} required className="h-8 w-36 py-1 text-xs" />
        <Input name="category" defaultValue={expense.category ?? ""} className="h-8 w-24 py-1 text-xs" />
        <Input
          name="amount_rupees"
          type="number"
          min={0}
          defaultValue={expense.amount_minor / 100}
          className="h-8 w-24 py-1 text-xs"
        />
        <Input
          name="incurred_on"
          type="date"
          defaultValue={expense.incurred_on}
          className="h-8 py-1 text-xs"
        />
        <input type="hidden" name="notes" value={expense.notes ?? ""} />
        <Button type="submit" size="sm" disabled={pending || deleting}>
          Save
        </Button>
        <ActionFeedback error={state.error} success={state.success} className="w-full text-xs" />
      </form>
      <form action={deleteAction}>
        <Button type="submit" size="sm" variant="ghost" disabled={pending || deleting}>
          Delete
        </Button>
        <ActionFeedback error={deleteState.error} success={deleteState.success} className="text-xs" />
      </form>
    </div>
  );
}
