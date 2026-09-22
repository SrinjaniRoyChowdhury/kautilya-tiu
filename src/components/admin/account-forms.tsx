"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
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
  allowedKinds,
  onSuccess,
}: {
  editions: Edition[];
  defaultKind?: AccountKind;
  lockKind?: boolean;
  allowedKinds?: readonly AccountKind[];
  onSuccess?: () => void;
}) {
  const kinds = allowedKinds?.length ? allowedKinds : (Object.keys(ACCOUNT_KIND_LABELS) as AccountKind[]);
  const fallbackKind =
    defaultKind && kinds.includes(defaultKind) ? defaultKind : (kinds[0] ?? "scanner");
  const [state, action, pending] = useActionState(createStaffAccountAction, {} as AccountState);
  const formKey = state.values
    ? `keep-${state.values.full_name ?? ""}|${state.values.username ?? ""}|${state.values.kind ?? ""}|${state.values.desk ?? ""}|${state.values.edition_id ?? ""}`
    : "new";

  useEffect(() => {
    if (state.success) onSuccess?.();
  }, [state.success, onSuccess]);

  const retainedKind = state.values?.kind;
  const initialKind =
    retainedKind && kinds.includes(retainedKind) ? retainedKind : fallbackKind;

  return (
    <CreateAccountFields
      key={formKey}
      action={action}
      pending={pending}
      state={state}
      editions={editions}
      defaultKind={defaultKind}
      lockKind={lockKind}
      kinds={kinds}
      initialFullName={state.values?.full_name ?? ""}
      initialUsername={state.values?.username ?? ""}
      initialKind={initialKind}
    />
  );
}

function CreateAccountFields({
  action,
  pending,
  state,
  editions,
  defaultKind,
  lockKind,
  kinds,
  initialFullName,
  initialUsername,
  initialKind,
}: {
  action: (payload: FormData) => void | Promise<void>;
  pending: boolean;
  state: AccountState;
  editions: Edition[];
  defaultKind?: AccountKind;
  lockKind?: boolean;
  kinds: readonly AccountKind[];
  initialFullName: string;
  initialUsername: string;
  initialKind: AccountKind;
}) {
  const [kind, setKind] = useState<AccountKind>(initialKind);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Full name" htmlFor="full_name">
        <Input
          id="full_name"
          name="full_name"
          required
          autoComplete="name"
          defaultValue={initialFullName}
        />
      </Field>
      <Field label="Username" htmlFor="username" hint="They sign in with this, not an email. e.g. admin1">
        <Input
          id="username"
          name="username"
          required
          autoComplete="off"
          defaultValue={initialUsername}
        />
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
            {kinds.map((item) => (
              <option key={item} value={item}>
                {ACCOUNT_KIND_LABELS[item]}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {(lockKind ? defaultKind : kind) === "scanner" ? (
        <ScannerFields
          editions={editions}
          defaultDesk={state.values?.desk}
          defaultEditionId={state.values?.edition_id}
        />
      ) : null}
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
  canManageAdmin = true,
}: {
  account: StaffAccount;
  editions: Edition[];
  canManageAdmin?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link
        href={`/admin/accounts/${account.user_id}/activity`}
        className="inline-flex h-9 items-center justify-center rounded-sm border border-gold-700/50 bg-parchment-50/70 px-3 text-sm font-medium tracking-wide text-gold-700 transition-colors hover:bg-parchment-200"
      >
        Activity
      </Link>
      <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
        Edit
      </Button>
      <DeleteAccountButton userId={account.user_id} name={account.username ?? account.full_name} />
      {editing ? (
        <EditAccountModal
          account={account}
          editions={editions}
          canManageAdmin={canManageAdmin}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}

function EditAccountModal({
  account,
  editions,
  canManageAdmin,
  onClose,
}: {
  account: StaffAccount;
  editions: Edition[];
  canManageAdmin: boolean;
  onClose: () => void;
}) {
  const kinds = canManageAdmin
    ? (Object.keys(ACCOUNT_KIND_LABELS) as AccountKind[])
    : (Object.keys(ACCOUNT_KIND_LABELS) as AccountKind[]).filter((item) => item !== "admin");
  const [kind, setKind] = useState<AccountKind>(
    kinds.includes(account.kind) ? account.kind : (kinds[0] ?? "viewer"),
  );
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
              {kinds.map((item) => (
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
  const [modalOpen, setModalOpen] = useState(false);
  const action = deleteStaffAccountAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(async (prev: AccountState, formData: FormData) => {
    const res = await action(prev, formData);
    if (res.success) setModalOpen(false);
    return res;
  }, {} as AccountState);

  return (
    <div className="inline-block">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setModalOpen(true)}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        Delete
      </Button>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Delete account: ${name}`}>
        <form action={formAction} className="grid gap-4">
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Super Admin verification required.</strong> They will no longer be able to sign in.
          </div>
          <Field label="Super Admin username / email" htmlFor={`sa-user-${userId}`}>
            <Input
              id={`sa-user-${userId}`}
              name="admin_username"
              required
              autoComplete="username"
              placeholder="e.g. admin or admin@kautilya.local"
            />
          </Field>
          <Field label="Super Admin password" htmlFor={`sa-pass-${userId}`}>
            <PasswordInput
              id={`sa-pass-${userId}`}
              name="admin_password"
              required
              autoComplete="current-password"
            />
          </Field>
          <div className="mt-2 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={pending}
              className="text-red-700 border-red-300 hover:bg-red-50"
            >
              {pending ? "Deleting…" : "Authorize & Delete"}
            </Button>
          </div>
          <ActionFeedback error={state.error} success={state.success} className="text-xs mt-1" />
        </form>
      </Modal>
    </div>
  );
}
