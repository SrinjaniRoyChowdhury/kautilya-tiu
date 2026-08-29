"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import {
  createStaffAccountAction,
  deleteStaffAccountAction,
  updateStaffAccountAction,
  type AccountState,
} from "@/app/actions/accounts";
import { ACCOUNT_KIND_LABELS, type AccountKind } from "@/lib/username";
import type { Edition, StaffAccount } from "@/types";

function ScannerFields({
  editions,
  defaultDesk,
  defaultEditionId,
  idPrefix = "",
}: {
  editions: Edition[];
  defaultDesk?: string;
  defaultEditionId?: string | null;
  idPrefix?: string;
}) {
  const active = editions.find((item) => item.is_public_active) ?? editions[0];
  const deskId = `${idPrefix}desk`;
  const editionId = `${idPrefix}edition_id`;
  return (
    <>
      <Field label="Desk" htmlFor={deskId}>
        <Select id={deskId} name="desk" defaultValue={defaultDesk ?? "both"}>
          <option value="attendance">Attendance only</option>
          <option value="food">Food only</option>
          <option value="both">Attendance and food</option>
        </Select>
      </Field>
      <Field label="Edition" htmlFor={editionId}>
        <Select id={editionId} name="edition_id" defaultValue={defaultEditionId ?? active?.id ?? "all"}>
          <option value="all">All editions</option>
          {editions.map((edition) => (
            <option key={edition.id} value={edition.id}>
              {edition.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

export function CreateAccountForm({
  editions,
  defaultKind,
  lockKind = false,
  onSuccess,
}: {
  editions: Edition[];
  defaultKind?: AccountKind;
  lockKind?: boolean;
  onSuccess?: () => void;
}) {
  const [kind, setKind] = useState<AccountKind>(defaultKind ?? "scanner");
  const [state, action, pending] = useActionState(createStaffAccountAction, {} as AccountState);

  useEffect(() => {
    if (state.success) onSuccess?.();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Full name" htmlFor="full_name">
        <Input id="full_name" name="full_name" required autoComplete="name" />
      </Field>
      <Field label="Username" htmlFor="username" hint="They sign in with this, not an email.">
        <Input id="username" name="username" required autoComplete="off" />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint="At least 8 characters, with upper, lower, and a number."
      >
        <PasswordInput id="password" name="password" required autoComplete="new-password" />
      </Field>
      {lockKind && defaultKind ? (
        <input type="hidden" name="kind" value={defaultKind} />
      ) : (
        <Field label="Account type" htmlFor="kind">
          <Select
            id="kind"
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as AccountKind)}
          >
            {(Object.keys(ACCOUNT_KIND_LABELS) as AccountKind[]).map((item) => (
              <option key={item} value={item}>
                {ACCOUNT_KIND_LABELS[item]}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {(lockKind ? defaultKind : kind) === "scanner" ? <ScannerFields editions={editions} /> : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
        <ActionFeedback error={state.error} success={state.success} />
      </div>
    </form>
  );
}

export function AccountRowActions({
  account,
  editions,
}: {
  account: StaffAccount;
  editions: Edition[];
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
        Edit
      </Button>
      <DeleteAccountButton userId={account.user_id} name={account.username ?? account.full_name} />
      {editing ? (
        <EditAccountModal account={account} editions={editions} onClose={() => setEditing(false)} />
      ) : null}
    </div>
  );
}

function EditAccountModal({
  account,
  editions,
  onClose,
}: {
  account: StaffAccount;
  editions: Edition[];
  onClose: () => void;
}) {
  const [kind, setKind] = useState<AccountKind>(account.kind);
  const action = updateStaffAccountAction.bind(null, account.user_id);
  const [state, formAction, pending] = useActionState(action, {} as AccountState);

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
      aria-label="Edit account"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
      onClick={onClose}
    >
      <div
        className="frame-gold max-h-[90vh] w-full max-w-lg overflow-y-auto bg-parchment-50 p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="font-serif text-2xl text-gold-700">Edit account</p>
        <form action={formAction} className="mt-4 grid gap-3">
          <Field label="Full name" htmlFor={`name-${account.user_id}`}>
            <Input id={`name-${account.user_id}`} name="full_name" defaultValue={account.full_name} required />
          </Field>
          <Field label="Username" htmlFor={`username-${account.user_id}`}>
            <Input
              id={`username-${account.user_id}`}
              name="username"
              defaultValue={account.username ?? ""}
              required
            />
          </Field>
          <Field
            label="Password"
            htmlFor={`password-${account.user_id}`}
            hint="Shown so you can copy it. Leave unchanged unless you need a new password."
          >
            <PasswordInput
              id={`password-${account.user_id}`}
              name="password"
              defaultValue={account.password_plain ?? ""}
              autoComplete="off"
              defaultVisible
            />
          </Field>
          <Field label="Account type" htmlFor={`kind-${account.user_id}`}>
            <Select
              id={`kind-${account.user_id}`}
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as AccountKind)}
            >
              {(Object.keys(ACCOUNT_KIND_LABELS) as AccountKind[]).map((item) => (
                <option key={item} value={item}>
                  {ACCOUNT_KIND_LABELS[item]}
                </option>
              ))}
            </Select>
          </Field>
          {kind === "scanner" ? (
            <ScannerFields
              editions={editions}
              defaultDesk={account.desk ?? "both"}
              defaultEditionId={account.edition_id}
              idPrefix={`edit-${account.user_id}-`}
            />
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save credentials"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
          <ActionFeedback error={state.error} success={state.success} />
        </form>
      </div>
    </div>
  );
}

function DeleteAccountButton({ userId, name }: { userId: string; name: string }) {
  const action = deleteStaffAccountAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, {} as AccountState);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Delete ${name}? They will no longer be able to sign in.`)) {
          event.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Deleting…" : "Delete"}
      </Button>
      <ActionFeedback error={state.error} className="text-xs" />
    </form>
  );
}
