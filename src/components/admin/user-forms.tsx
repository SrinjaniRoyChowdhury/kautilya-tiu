"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { deleteSignedUpUserAction, updateSignedUpUserAction, type UserAdminState } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
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

export function DeleteUserButton({
  userId,
  userName,
  variant = "ghost",
  size = "sm",
  redirectAfterDelete = false,
}: {
  userId: string;
  userName: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  redirectAfterDelete?: boolean;
}) {
  const router = useRouter();
  const action = deleteSignedUpUserAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(async (prev: UserAdminState, formData: FormData) => {
    const res = await action(prev, formData);
    if (res.success && redirectAfterDelete) {
      router.push("/admin/users");
    }
    return res;
  }, {} as UserAdminState);

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

