"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  createScannerAction,
  removeScannerRoleAction,
  updateScannerCredentialsAction,
  type ScannerState,
} from "@/app/actions/scanners";
import type { Edition, ScannerAssignment } from "@/types";

export function CreateScannerForm({ editions }: { editions: Edition[] }) {
  const [state, action, pending] = useActionState(createScannerAction, {} as ScannerState);
  const active = editions.find((item) => item.is_public_active) ?? editions[0];

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
      <Field label="Full name" htmlFor="full_name">
        <Input id="full_name" name="full_name" required autoComplete="name" />
      </Field>
      <Field label="Email" htmlFor="email" hint="They sign in with this address. Do not reuse a delegate email.">
        <Input id="email" name="email" type="email" required autoComplete="off" />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint="At least 8 characters, with upper, lower, and a number. The current password stays visible on this list."
      >
        <Input id="password" name="password" type="text" required autoComplete="new-password" />
      </Field>
      <Field label="Desk" htmlFor="desk">
        <Select id="desk" name="desk" defaultValue="both">
          <option value="attendance">Attendance only</option>
          <option value="food">Food only</option>
          <option value="both">Attendance and food</option>
        </Select>
      </Field>
      <Field label="Edition" htmlFor="edition_id">
        <Select id="edition_id" name="edition_id" defaultValue={active?.id ?? "all"}>
          <option value="all">All editions</option>
          {editions.map((edition) => (
            <option key={edition.id} value={edition.id}>
              {edition.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create scanner login"}
      </Button>
    </form>
  );
}

function roleLabel(name: string) {
  if (name === "FOOD_OPERATOR") return "Food";
  if (name === "ATTENDANCE_OPERATOR") return "Attendance";
  return name;
}

export function ScannerList({ rows }: { rows: ScannerAssignment[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  if (!rows.length) {
    return <p className="text-sm text-ink-muted">No desk scanners yet.</p>;
  }
  const grouped = new Map<
    string,
    {
      user_id: string;
      full_name: string;
      email: string;
      password_plain: string | null;
      desks: ScannerAssignment[];
    }
  >();
  for (const row of rows) {
    const current = grouped.get(row.user_id);
    if (current) current.desks.push(row);
    else {
      grouped.set(row.user_id, {
        user_id: row.user_id,
        full_name: row.full_name,
        email: row.email,
        password_plain: row.password_plain ?? null,
        desks: [row],
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
                <ul className="mt-2 grid gap-1 text-sm text-ink-muted">
                  {person.desks.map((row) => (
                    <li key={row.id}>
                      {roleLabel(row.role_name)} · {row.edition_name ?? "All editions"}
                    </li>
                  ))}
                </ul>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(person.user_id)}>
                Edit
              </Button>
            </div>
            <ul className="mt-3 grid gap-2">
              {person.desks.map((row) => (
                <li key={`${row.id}-remove`} className="flex justify-end">
                  <RemoveScannerButton assignmentId={row.id} label={`Remove ${roleLabel(row.role_name)}`} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {active ? (
        <EditScannerModal
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

function EditScannerModal({
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
  const action = updateScannerCredentialsAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, {} as ScannerState);

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
      aria-label="Edit scanner"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
      onClick={onClose}
    >
      <div
        className="frame-gold max-h-[90vh] w-full max-w-lg overflow-y-auto bg-parchment-50 p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="font-serif text-2xl text-gold-700">Edit scanner</p>
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
          <Field label="Full name" htmlFor={`name-${userId}`}>
            <Input id={`name-${userId}`} name="full_name" defaultValue={fullName} required />
          </Field>
          <Field label="Email" htmlFor={`email-${userId}`}>
            <Input id={`email-${userId}`} name="email" type="email" defaultValue={email} required />
          </Field>
          <Field
            label="Password"
            htmlFor={`password-${userId}`}
            hint="Shown so you can copy it. Leave unchanged unless you need a new password."
          >
            <Input
              id={`password-${userId}`}
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

function RemoveScannerButton({ assignmentId, label }: { assignmentId: string; label: string }) {
  const action = removeScannerRoleAction.bind(null, assignmentId);
  const [state, formAction, pending] = useActionState(action, {} as ScannerState);
  return (
    <form action={formAction}>
      {state.error ? (
        <p className="mb-2 text-xs text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Removing…" : label}
      </Button>
    </form>
  );
}
