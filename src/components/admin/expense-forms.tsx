"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
  type ExpenseState,
} from "@/app/actions/expenses";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal, ModalTrigger } from "@/components/ui/modal";
import { formatInrFromMinor } from "@/lib/format";
import type { EditionExpense } from "@/types";

export function CreateExpenseForm({
  editionId,
  onSuccess,
}: {
  editionId: string;
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(createExpenseAction, {} as ExpenseState);

  useEffect(() => {
    if (state.success) onSuccess?.();
  }, [state.success, onSuccess]);

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
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add expense"}
        </Button>
        <ActionFeedback error={state.error} success={state.success} />
      </div>
    </form>
  );
}

export function CreateExpenseModalButton({ editionId }: { editionId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ModalTrigger label="Add expense" onOpen={() => setOpen(true)} />
      <Modal open={open} title="Add expense" onClose={() => setOpen(false)} wide>
        <CreateExpenseForm editionId={editionId} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function EditExpenseModal({ expense, onClose }: { expense: EditionExpense; onClose: () => void }) {
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

  useEffect(() => {
    if (state.success || deleteState.success) onClose();
  }, [state.success, deleteState.success, onClose]);

  return (
    <Modal open title="Edit expense" onClose={onClose} wide>
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="edition_id" value={expense.edition_id} />
        <Field label="Title" htmlFor={`title-${expense.id}`}>
          <Input id={`title-${expense.id}`} name="title" defaultValue={expense.title} required />
        </Field>
        <Field label="Category" htmlFor={`category-${expense.id}`}>
          <Input id={`category-${expense.id}`} name="category" defaultValue={expense.category ?? ""} />
        </Field>
        <Field label="Amount (₹)" htmlFor={`amount-${expense.id}`}>
          <Input
            id={`amount-${expense.id}`}
            name="amount_rupees"
            type="number"
            min={0}
            defaultValue={expense.amount_minor / 100}
            required
          />
        </Field>
        <Field label="Date" htmlFor={`date-${expense.id}`}>
          <Input
            id={`date-${expense.id}`}
            name="incurred_on"
            type="date"
            defaultValue={expense.incurred_on}
            required
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes" htmlFor={`notes-${expense.id}`}>
            <Textarea id={`notes-${expense.id}`} name="notes" defaultValue={expense.notes ?? ""} />
          </Field>
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || deleting}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <ActionFeedback error={state.error} success={state.success} className="sm:col-span-2" />
      </form>
      <form action={deleteAction} className="mt-4 border-t border-gold-700/15 pt-4">
        <Button type="submit" variant="ghost" size="sm" disabled={pending || deleting}>
          {deleting ? "Deleting…" : "Delete expense"}
        </Button>
        <ActionFeedback error={deleteState.error} success={deleteState.success} className="text-xs" />
      </form>
    </Modal>
  );
}

function ExpenseRowActions({ expense }: { expense: EditionExpense }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open ? <EditExpenseModal expense={expense} onClose={() => setOpen(false)} /> : null}
    </>
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
    <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
      <thead className="sticky top-0 z-10 bg-parchment-50">
        <tr className="border-b border-gold-700/25 text-xs uppercase tracking-wide text-gold-700">
          <th className="px-2 py-1.5 font-medium">Date</th>
          <th className="px-2 py-1.5 font-medium">Title</th>
          <th className="px-2 py-1.5 font-medium">Category</th>
          <th className="px-2 py-1.5 font-medium">Amount</th>
          {canEdit ? <th className="px-2 py-1.5 font-medium" /> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-gold-700/10 hover:bg-parchment-100">
            <td className="px-2 py-1.5 whitespace-nowrap">{row.incurred_on}</td>
            <td className="px-2 py-1.5 font-medium">{row.title}</td>
            <td className="px-2 py-1.5 text-ink-muted">{row.category ?? "—"}</td>
            <td className="px-2 py-1.5">{formatInrFromMinor(row.amount_minor)}</td>
            {canEdit ? (
              <td className="px-2 py-1.5 text-right">
                <ExpenseRowActions expense={row} />
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
