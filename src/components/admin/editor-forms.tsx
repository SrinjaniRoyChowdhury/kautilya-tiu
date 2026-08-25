"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  createEditorAction,
  removeEditorRoleAction,
  updateEditorCredentialsAction,
  type EditorState,
} from "@/app/actions/editors";
import type { ScannerAssignment } from "@/types";

export function CreateEditorForm() {
  const [state, action, pending] = useActionState(createEditorAction, {} as EditorState);

  return (
    <form action={action} className="grid gap-4">
      {state.error ? (
        <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-sm bg-parchment-200 px-3 py-2 text-sm" role="status">
          {state.success}
        </p>
      ) : null}
      <Field label="Full name" htmlFor="editor_full_name">
        <Input id="editor_full_name" name="full_name" required autoComplete="name" />
      </Field>
      <Field label="Email" htmlFor="editor_email" hint="They sign in with this address. Do not reuse a delegate email.">
        <Input id="editor_email" name="email" type="email" required autoComplete="off" />
      </Field>
      <Field
        label="Password"
        htmlFor="editor_password"
        hint="At least 8 characters, with upper, lower, and a number. The current password stays visible on this list."
      >
        <Input id="editor_password" name="password" type="text" required autoComplete="new-password" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create editor login"}
      </Button>
    </form>
  );
}

export function EditorList({ rows }: { rows: ScannerAssignment[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  if (!rows.length) {
    return <p className="text-sm text-ink-muted">No content editors yet.</p>;
  }
  const grouped = new Map<
    string,
    {
      user_id: string;
      full_name: string;
      email: string;
      password_plain: string | null;
      assignments: ScannerAssignment[];
    }
  >();
  for (const row of rows) {
    const current = grouped.get(row.user_id);
    if (current) current.assignments.push(row);
    else {
      grouped.set(row.user_id, {
        user_id: row.user_id,
        full_name: row.full_name,
        email: row.email,
        password_plain: row.password_plain ?? null,
        assignments: [row],
      });
    }
  }
  const people = [...grouped.values()];
  const active = people.find((person) => person.user_id === editing) ?? null;

  return (
    <>
      <ul className="grid gap-4">
        {people.map((person) => (
          <li key={person.user_id} className="rounded-sm border border-gold-700/20 px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{person.full_name}</p>
                <p className="text-sm text-ink-muted">{person.email}</p>
                <p className="mt-2 text-sm">
                  Password:{" "}
                  {person.password_plain ? (
                    <span className="font-mono">{person.password_plain}</span>
                  ) : (
                    <span className="text-ink-muted">Not stored — save a password to keep it visible.</span>
                  )}
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(person.user_id)}>
                Edit
              </Button>
            </div>
            <ul className="mt-3 grid gap-2">
              {person.assignments.map((row) => (
                <li key={row.id} className="flex justify-end">
                  <RemoveEditorButton assignmentId={row.id} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {active ? (
        <EditEditorModal
          userId={active.user_id}
          fullName={active.full_name}
          email={active.email}
          password={active.password_plain ?? ""}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function EditEditorModal({
  userId,
  fullName,
  email,
  password,
  onClose,
}: {
  userId: string;
  fullName: string;
  email: string;
  password: string;
  onClose: () => void;
}) {
  const action = updateEditorCredentialsAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, {} as EditorState);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit editor"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
      onClick={onClose}
    >
      <div
        className="frame-gold max-h-[90vh] w-full max-w-lg overflow-y-auto bg-parchment-50 p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="font-serif text-2xl text-gold-700">Edit editor</p>
        <form action={formAction} className="mt-4 grid gap-3">
          {state.error ? (
            <p className="text-sm text-red-800" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="text-sm" role="status">
              {state.success}
            </p>
          ) : null}
          <Field label="Full name" htmlFor={`editor-name-${userId}`}>
            <Input id={`editor-name-${userId}`} name="full_name" defaultValue={fullName} required />
          </Field>
          <Field label="Email" htmlFor={`editor-email-${userId}`}>
            <Input id={`editor-email-${userId}`} name="email" type="email" defaultValue={email} required />
          </Field>
          <Field
            label="Password"
            htmlFor={`editor-password-${userId}`}
            hint="Shown so you can copy it. Leave unchanged unless you need a new password."
          >
            <Input
              id={`editor-password-${userId}`}
              name="password"
              type="text"
              defaultValue={password}
              autoComplete="off"
            />
          </Field>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save credentials"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RemoveEditorButton({ assignmentId }: { assignmentId: string }) {
  const action = removeEditorRoleAction.bind(null, assignmentId);
  const [state, formAction, pending] = useActionState(action, {} as EditorState);
  return (
    <form action={formAction}>
      {state.error ? (
        <p className="mb-2 text-xs text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Removing…" : "Remove access"}
      </Button>
    </form>
  );
}
