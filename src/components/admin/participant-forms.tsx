"use client";

import { useActionState } from "react";
import {
  confirmParticipantFreeAction,
  deleteParticipantAction,
  setParticipantPasswordAction,
  type ParticipantAdminState,
} from "@/app/actions/participants";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import type { AdminParticipant } from "@/types";

export function ParticipantPasswordForm({ registrationId }: { registrationId: string }) {
  const action = setParticipantPasswordAction.bind(null, registrationId);
  const [state, formAction, pending] = useActionState(action, {} as ParticipantAdminState);
  return (
    <form action={formAction} className="grid gap-2.5">
      <Field
        label="New password"
        htmlFor="password"
        hint="Min 8 chars, upper, lower, number."
      >
        <PasswordInput id="password" name="password" required autoComplete="new-password" />
      </Field>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Saving…" : "Update password"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}

export function DeleteParticipantForm({ participant }: { participant: AdminParticipant }) {
  const action = deleteParticipantAction.bind(null, participant.id);
  const [state, formAction, pending] = useActionState(action, {} as ParticipantAdminState);
  if (participant.paid || participant.confirmed_free) {
    return (
      <form action={formAction} className="grid gap-2.5">
        <div className="rounded-sm border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          Paid/confirmed delete needs admin re-auth and a reason for the audit trail.
        </div>
        <Field label="Admin username / email" htmlFor="admin_username">
          <Input
            id="admin_username"
            name="admin_username"
            required
            autoComplete="username"
            placeholder="admin or admin@…"
          />
        </Field>
        <Field label="Admin password" htmlFor="admin_password">
          <PasswordInput id="admin_password" name="admin_password" required autoComplete="current-password" />
        </Field>
        <Field label="Reason" htmlFor="reason" hint="Stored permanently in audit log.">
          <Input id="reason" name="reason" required placeholder="e.g. Duplicate / refunded" />
        </Field>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={pending}
          className="text-red-700 border-red-300 hover:bg-red-50"
        >
          {pending ? "Deleting…" : "Authorize & delete"}
        </Button>
        <ActionFeedback error={state.error} success={state.success} />
      </form>
    );
  }
  return (
    <form action={formAction} className="grid gap-2">
      <p className="text-xs text-ink-muted">
        Removes {participant.full_name} from this edition. Only before payment.
      </p>
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Deleting…" : "Delete unpaid participant"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}

export function ConfirmFreeParticipantForm({ participant }: { participant: AdminParticipant }) {
  const action = confirmParticipantFreeAction.bind(null, participant.id);
  const [state, formAction, pending] = useActionState(action, {} as ParticipantAdminState);

  if (participant.confirmed_free) {
    return (
      <p className="text-sm text-ink-muted">
        Confirmed as a free participant. No payment was recorded.
      </p>
    );
  }
  if (participant.paid || participant.status === "CONFIRMED") {
    return null;
  }
  if (participant.status === "DRAFT" || participant.status === "CANCELLED") {
    return (
      <p className="text-sm text-ink-muted">They must submit a registration before confirmation.</p>
    );
  }
  if (participant.status === "SUBMITTED" || !participant.committee_id) {
    return (
      <p className="text-sm text-ink-muted">
        Allocate a committee and portfolio first, then you can confirm without payment.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-2">
      <p className="text-xs text-ink-muted">
        Confirm without payment. Credential issued; revenue unchanged.
      </p>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Confirming…" : "Confirm as free participant"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}
