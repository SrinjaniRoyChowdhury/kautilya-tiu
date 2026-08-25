"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  createScannerAction,
  removeScannerRoleAction,
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
        hint="At least 8 characters, with upper, lower, and a number. Share it out of band."
      >
        <Input id="password" name="password" type="password" required autoComplete="new-password" />
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
  if (!rows.length) {
    return <p className="text-sm text-ink-muted">No desk scanners yet.</p>;
  }
  return (
    <ul className="grid gap-3">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 rounded-sm border border-gold-700/20 px-3 py-3">
          <div>
            <p className="font-medium">{row.full_name}</p>
            <p className="text-sm text-ink-muted">
              {row.email} · {roleLabel(row.role_name)} · {row.edition_name ?? "All editions"}
            </p>
          </div>
          <RemoveScannerButton assignmentId={row.id} />
        </li>
      ))}
    </ul>
  );
}

function RemoveScannerButton({ assignmentId }: { assignmentId: string }) {
  const action = removeScannerRoleAction.bind(null, assignmentId);
  const [state, formAction, pending] = useActionState(action, {} as ScannerState);
  return (
    <form action={formAction}>
      {state.error ? (
        <p className="mb-2 text-xs text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Removing…" : "Remove access"}
      </Button>
    </form>
  );
}
