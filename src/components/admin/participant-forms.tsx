"use client";

import { useActionState } from "react";
import {
  confirmParticipantFreeAction,
  convertRegistrationToDoubleAction,
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
          Paid/confirmed delete needs Super Admin re-auth and a reason for the audit trail.
        </div>
        <Field label="Super Admin username / email" htmlFor="admin_username">
          <Input
            id="admin_username"
            name="admin_username"
            required
            autoComplete="username"
            placeholder="admin or admin@…"
          />
        </Field>
        <Field label="Super Admin password" htmlFor="admin_password">
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

export function ConvertToDoubleForm({ participant }: { participant: AdminParticipant }) {
  const action = convertRegistrationToDoubleAction.bind(null, participant.id);
  const [state, formAction, pending] = useActionState(action, {} as ParticipantAdminState);
  const allotted = Boolean(participant.committee_id);
  const blocked =
    participant.delegation_type === "DOUBLE" ||
    participant.status === "DRAFT" ||
    participant.status === "CANCELLED" ||
    participant.is_pair_lead === false;

  if (blocked) return null;

  return (
    <form action={formAction} className="grid gap-2.5">
      <p className="text-xs text-ink-muted">
        Link a co-delegate on the same committee
        {allotted ? ` (${participant.committee_short_name ?? "current"})` : ""}. Partner need not be
        registered yet — a verified account is created if needed. Expected fee becomes the double
        rate when allotted.
      </p>
      <Field label="Partner email" htmlFor="partner_email">
        <Input
          id="partner_email"
          name="partner_email"
          type="email"
          required
          autoComplete="off"
          placeholder="partner@example.com"
        />
      </Field>
      <Field label="Partner name" htmlFor="partner_name" hint="Optional; used when creating a new account.">
        <Input id="partner_name" name="partner_name" autoComplete="off" />
      </Field>
      {allotted ? (
        <>
          <Field
            label="Portfolio"
            htmlFor="allocated_portfolio"
            hint="Leave blank to keep the current allotment."
          >
            <Input
              id="allocated_portfolio"
              name="allocated_portfolio"
              defaultValue={participant.allocated_portfolio ?? ""}
              placeholder={participant.allocated_portfolio ?? "e.g. India"}
            />
          </Field>
          <Field label="SLR" htmlFor="allocated_slr" hint="Optional seat number; blank keeps current.">
            <Input
              id="allocated_slr"
              name="allocated_slr"
              type="number"
              min={1}
              defaultValue={participant.allocated_slr != null ? String(participant.allocated_slr) : ""}
            />
          </Field>
        </>
      ) : null}
      <Field label="Reason" htmlFor="reason" hint="Stored in the audit log.">
        <Input
          id="reason"
          name="reason"
          required
          placeholder="e.g. Teaming up after single payment"
        />
      </Field>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Converting…" : "Convert to double del"}
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
