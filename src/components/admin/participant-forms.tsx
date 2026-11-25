"use client";

import { useActionState } from "react";
import {
  recordParticipantPaymentAction,
  type AdminPaymentState,
} from "@/app/actions/admin-payments";
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
import { formatInrFromMinor } from "@/lib/format";
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

/** Record an offline / separate UPI payment for this participant → revenue + credentials. */
export function RecordParticipantPaymentForm({ participant }: { participant: AdminParticipant }) {
  const action = recordParticipantPaymentAction.bind(null, participant.id);
  const [state, formAction, pending] = useActionState(action, {} as AdminPaymentState);

  if (participant.confirmed_free) {
    return (
      <p className="text-sm text-ink-muted">
        Confirmed free — no payment to record.
      </p>
    );
  }
  if (participant.paid || participant.status === "CONFIRMED" || participant.status === "PAYMENT_VERIFIED") {
    return (
      <p className="text-sm text-ink-muted">
        Payment already recorded or under review.
      </p>
    );
  }
  if (participant.status === "DRAFT" || participant.status === "CANCELLED") {
    return (
      <p className="text-sm text-ink-muted">They must submit a registration first.</p>
    );
  }
  if (!participant.committee_id) {
    return (
      <p className="text-sm text-ink-muted">
        Allocate a committee and portfolio first, then record payment.
      </p>
    );
  }
  if (participant.is_pair_lead === false && (participant.expected_fee_minor ?? 0) <= 0) {
    return (
      <p className="text-sm text-ink-muted">
        Co-delegate fee is covered by the pair lead. Record payment on the lead, or use free
        confirmation for this co-delegate.
      </p>
    );
  }

  const defaultRupees =
    participant.expected_fee_minor != null && participant.expected_fee_minor > 0
      ? String(Math.round(participant.expected_fee_minor / 100))
      : "";
  const feeHint =
    participant.expected_fee_minor != null && participant.expected_fee_minor > 0
      ? `Allotted fee ${formatInrFromMinor(participant.expected_fee_minor)}. Amount entered is added to total revenue.`
      : "Amount entered is added to total revenue.";

  return (
    <form action={formAction} className="grid gap-2.5" encType="multipart/form-data">
      <p className="text-xs text-ink-muted">
        For delegates who paid separately (offline UPI). Records a verified payment, confirms them
        {participant.delegation_type === "DOUBLE" && participant.is_pair_lead !== false
          ? " (and co-delegate)"
          : ""}
        , and emails credentials.
      </p>
      <Field label="Amount paid (₹)" htmlFor="amount_rupees" hint={feeHint}>
        <Input
          id="amount_rupees"
          name="amount_rupees"
          type="number"
          min={1}
          step={1}
          required
          defaultValue={defaultRupees}
          placeholder="e.g. 1500"
        />
      </Field>
      <Field label="Transaction / UPI ref" htmlFor="transaction_ref" hint="Optional.">
        <Input
          id="transaction_ref"
          name="transaction_ref"
          autoComplete="off"
          placeholder="UPI ref or bank UTR"
        />
      </Field>
      <Field label="Screenshot" htmlFor="proof" hint="Optional JPEG / PNG / WebP, max 5 MB.">
        <Input id="proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp" />
      </Field>
      <Field label="Reason" htmlFor="reason" hint="At least 3 characters — audit log.">
        <Input
          id="reason"
          name="reason"
          required
          minLength={3}
          placeholder="e.g. Paid via UPI outside app; screenshot on WhatsApp"
        />
      </Field>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Recording…" : "Record payment & issue credentials"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}
