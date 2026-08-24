"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { updateProfileAction, type RegistrationState } from "@/app/actions/registrations";
import type { Profile } from "@/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfileAction, {} as RegistrationState);
  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
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
      <Field label="Full name" htmlFor="full_name" error={state.fieldErrors?.full_name}>
        <Input id="full_name" name="full_name" defaultValue={profile.full_name} required />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} />
      </Field>
      <p className="text-sm text-ink-muted">{profile.email}</p>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
