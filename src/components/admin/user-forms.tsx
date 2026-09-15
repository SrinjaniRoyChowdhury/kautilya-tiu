"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteSignedUpUserAction,
  manualVerifyUserAction,
  updateSignedUpUserAction,
  type UserAdminState,
} from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PasswordInput } from "@/components/ui/password-input";
import { PHONE_HINT, phoneInputProps } from "@/lib/phone";
import type { AdminUser } from "@/types";

export function UserCredentialsForm({ user }: { user: AdminUser }) {
  const action = updateSignedUpUserAction.bind(null, user.id);
  const [state, formAction, pending] = useActionState(action, {} as UserAdminState);
  return (
    <form action={formAction} className="grid gap-4">
      <Field label="Full name" htmlFor="full_name" error={state.fieldErrors?.full_name}>
        <Input id="full_name" name="full_name" defaultValue={user.full_name} required autoComplete="name" />
      </Field>
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" defaultValue={user.email} required autoComplete="email" />
      </Field>
      <Field label="Phone" htmlFor="phone" hint={PHONE_HINT} error={state.fieldErrors?.phone}>
        <Input id="phone" name="phone" required defaultValue={user.phone ?? ""} {...phoneInputProps} />
      </Field>
      <Field
        label="New password"
        htmlFor="password"
        hint="Leave blank to keep the current password. At least 8 characters, with upper, lower, and a number."
        error={state.fieldErrors?.password}
      >
        <PasswordInput id="password" name="password" autoComplete="new-password" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save credentials"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}

export function ManualVerifyUserButton({
  userId,
  userName,
  variant = "secondary",
  size = "sm",
}: {
  userId: string;
  userName: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
}) {
  const action = manualVerifyUserAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, {} as UserAdminState);

  return (
    <form
      action={formAction}
      className="inline-block"
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Manually verify email for "${userName}"? They will be marked verified and sent a notice email (so they know they can sign in without the Brevo link).`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {pending ? "Verifying…" : "Verify email"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} className="text-xs mt-1" />
    </form>
  );
}

export function DeleteUserButton({
  userId,
  userName,
  isPaid = false,
  variant = "ghost",
  size = "sm",
  redirectAfterDelete = false,
}: {
  userId: string;
  userName: string;
  isPaid?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  redirectAfterDelete?: boolean;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const action = deleteSignedUpUserAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(async (prev: UserAdminState, formData: FormData) => {
    const res = await action(prev, formData);
    if (res.success) {
      setModalOpen(false);
      if (redirectAfterDelete) {
        router.push("/admin/users");
      }
    }
    return res;
  }, {} as UserAdminState);

  if (isPaid) {
    return (
      <div className="inline-block">
        <Button
          type="button"
          variant={variant}
          size={size}
          onClick={() => setModalOpen(true)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          Delete
        </Button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Delete Paid User: ${userName}`}
        >
          <form action={formAction} className="grid gap-4">
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>Caution:</strong> This user has paid registration records. Deleting them will cancel their registrations, delete their login credentials, and requires admin re-authentication and a mandatory reason for the audit trail.
            </div>
            <Field label="Admin Username / Email" htmlFor={`admin_user_${userId}`}>
              <Input
                id={`admin_user_${userId}`}
                name="admin_username"
                required
                autoComplete="username"
                placeholder="e.g. admin or admin@kautilya.local"
              />
            </Field>
            <Field label="Admin Password" htmlFor={`admin_pass_${userId}`}>
              <PasswordInput
                id={`admin_pass_${userId}`}
                name="admin_password"
                required
                autoComplete="current-password"
              />
            </Field>
            <Field
              label="Reason for deletion"
              htmlFor={`reason_${userId}`}
              hint="This reason will be visible permanently in the audit log."
            >
              <Input
                id={`reason_${userId}`}
                name="reason"
                required
                placeholder="e.g. Requested account closure / refunded"
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

  return (
    <form
      action={formAction}
      className="inline-block"
      onSubmit={(event) => {
        if (!window.confirm(`Delete user "${userName}"? This action cannot be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <Button type="submit" variant={variant} size={size} disabled={pending} className="text-red-600 hover:text-red-700 hover:bg-red-50">
        {pending ? "Deleting…" : "Delete"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} className="text-xs mt-1" />
    </form>
  );
}

