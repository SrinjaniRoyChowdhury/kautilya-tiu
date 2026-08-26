"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { updateProfileAction, type RegistrationState } from "@/app/actions/registrations";
import type { Profile } from "@/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfileAction, {} as RegistrationState);
  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
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
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}
