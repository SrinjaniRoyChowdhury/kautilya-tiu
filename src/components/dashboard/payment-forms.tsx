"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { DelegateEmailPicker } from "@/components/dashboard/delegate-email-picker";
import { Field, Input, Select } from "@/components/ui/field";
import {
  addPaymentEmailsAction,
  correctUnmatchedEmailAction,
  submitPaymentProofAction,
  type PaymentState,
} from "@/app/actions/payments";
import { formatInrFromMinor, localDateTimeValue } from "@/lib/format";
import {
  AMOUNT_FLAG_COPY,
  PAYMENT_STATUS_COPY,
  participantEmail,
  participantName,
  participantResolution,
  paymentEditable,
} from "@/lib/payments";
import type { PaymentInstructions, PaymentParticipant, PaymentWithParticipants } from "@/types";

function TransferDateTimeField() {
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("12");
  const [minute, setMinute] = useState("00");
  const [meridiem, setMeridiem] = useState<"AM" | "PM">("AM");
  const paidAt = useMemo(
    () => localDateTimeValue(date, Number(hour), Number(minute), meridiem),
    [date, hour, minute, meridiem],
  );
  const timeDisabled = !date;

  return (
    <Field
      label="Date and time of transfer (optional)"
      htmlFor="paid_at_date"
      hint="12-hour clock with AM/PM. Leave the date empty to skip."
    >
      <input type="hidden" name="paid_at" value={paidAt} />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input id="paid_at_date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          <Select
            id="paid_at_hour"
            aria-label="Hour"
            disabled={timeDisabled}
            value={hour}
            onChange={(event) => setHour(event.target.value)}
          >
            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Select
            id="paid_at_minute"
            aria-label="Minute"
            disabled={timeDisabled}
            value={minute}
            onChange={(event) => setMinute(event.target.value)}
          >
            {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Select
            id="paid_at_meridiem"
            aria-label="AM or PM"
            disabled={timeDisabled}
            value={meridiem}
            onChange={(event) => setMeridiem(event.target.value === "PM" ? "PM" : "AM")}
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </Select>
        </div>
      </div>
    </Field>
  );
}

function Alert({ state }: { state: PaymentState }) {
  return <ActionFeedback error={state.error} success={state.success} warning={state.warning} />;
}

export function PaymentInstructionsCard({
  instructions,
  expectedMinor,
}: {
  instructions: PaymentInstructions | null;
  expectedMinor: number;
}) {
  const upi = instructions?.upi_id;
  const copyValue = upi ?? instructions?.account_number ?? "";
  return (
    <div className="grid gap-3">
      <p className="text-xs uppercase tracking-widest text-gold-700">Pay this amount</p>
      <p className="font-serif text-4xl text-gold-700">{formatInrFromMinor(expectedMinor)}</p>
      {instructions?.upi_qr_image_key ? (
        // Streamed same-origin QR; not a remote next/image host.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/pay/qr/${instructions.edition_id}`}
          alt="UPI payment QR"
          className="h-48 w-48 rounded-sm border border-gold-700/25 bg-parchment-50 object-contain"
        />
      ) : null}
      <p className="text-sm text-ink-muted">
        Manual UPI / bank transfer only. No payment gateway. Transfer the expected total, then
        upload the screenshot below.
      </p>
      {upi ? (
        <p className="font-mono text-lg text-ink">
          UPI: {upi}
          {copyValue ? (
            <button
              type="button"
              className="ml-3 text-sm text-gold-700 hover:underline"
              onClick={() => navigator.clipboard.writeText(upi)}
            >
              Copy
            </button>
          ) : null}
        </p>
      ) : null}
      {instructions?.account_name ? (
        <p className="text-sm">
          {instructions.account_name}
          {instructions.bank_name ? ` · ${instructions.bank_name}` : ""}
        </p>
      ) : null}
      {instructions?.account_number ? (
        <p className="font-mono text-sm">A/c {instructions.account_number}</p>
      ) : null}
      {instructions?.ifsc ? <p className="font-mono text-sm">IFSC {instructions.ifsc}</p> : null}
      {instructions?.notes ? <p className="text-sm text-ink-muted">{instructions.notes}</p> : null}
    </div>
  );
}

export function PaymentParticipants({
  paymentId,
  editionId,
  participants,
  editable,
}: {
  paymentId: string;
  editionId: string;
  participants: PaymentParticipant[];
  editable: boolean;
}) {
  const addAction = addPaymentEmailsAction.bind(null, paymentId);
  const [addState, addForm, addPending] = useActionState(addAction, {} as PaymentState);
  const correctAction = correctUnmatchedEmailAction.bind(null, paymentId);
  const [correctState, correctForm, correctPending] = useActionState(
    correctAction,
    {} as PaymentState,
  );
  const takenEmails = participants.map((row) => participantEmail(row));

  return (
    <div className="grid gap-4">
      <ul className="grid gap-3">
        {participants.map((row) => (
          <li key={row.id} className="rounded-sm border border-gold-700/20 px-3 py-3">
            <p className="font-medium">{participantName(row)}</p>
            <p className="text-sm text-ink-muted">{participantEmail(row)}</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-gold-700">
              {participantResolution(row)} · {formatInrFromMinor(row.amount_minor)}
            </p>
            {editable && !row.registration_id ? (
              <form action={correctForm} className="mt-3 grid gap-3">
                <input type="hidden" name="participant_id" value={row.id} />
                <DelegateEmailPicker
                  editionId={editionId}
                  name="email"
                  inputId={`email-${row.id}`}
                  single
                  excludeEmails={takenEmails.filter((email) => email !== participantEmail(row))}
                  label="Replace with a registered delegate"
                  hint="Unmatched emails cannot be paid. Search for someone who has submitted a registration."
                />
                <Button type="submit" size="sm" disabled={correctPending}>
                  Update
                </Button>
                <Alert state={correctState} />
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {editable ? (
        <form action={addForm} className="grid gap-3">
          <DelegateEmailPicker
            editionId={editionId}
            excludeEmails={takenEmails}
            label="Add registered delegates"
          />
          <Button type="submit" variant="secondary" disabled={addPending}>
            {addPending ? "Adding…" : "Add participants"}
          </Button>
          <Alert state={addState} />
        </form>
      ) : null}
    </div>
  );
}

export function PaymentProofForm({
  payment,
}: {
  payment: PaymentWithParticipants;
}) {
  const action = submitPaymentProofAction.bind(null, payment.id);
  const [state, formAction, pending] = useActionState(action, {} as PaymentState);
  const copy = PAYMENT_STATUS_COPY[payment.status];
  const editable = paymentEditable(payment.status);

  if (!editable) {
    return (
      <div>
        <p className="font-serif text-2xl">{copy.label}</p>
        <p className="mt-2 text-sm text-ink-muted">{copy.detail}</p>
        {payment.paid_amount_minor != null ? (
          <p className="mt-3 text-sm">
            Declared {formatInrFromMinor(payment.paid_amount_minor)} · expected{" "}
            {formatInrFromMinor(payment.expected_amount_minor)} ·{" "}
            {AMOUNT_FLAG_COPY[payment.amount_flag]}
          </p>
        ) : null}
        {payment.rejection_reason ? (
          <p className="mt-3 text-sm text-red-800" role="status">
            Rejection reason: {payment.rejection_reason}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      {payment.rejection_reason ? (
        <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="status">
          Previous rejection: {payment.rejection_reason}. Upload a new screenshot for a fresh
          review.
        </p>
      ) : null}
      <Field
        label="Amount transferred (₹)"
        htmlFor="paid_rupees"
        hint={`Expected ${formatInrFromMinor(payment.expected_amount_minor)} from the linked registrations.`}
      >
        <Input
          id="paid_rupees"
          name="paid_rupees"
          type="number"
          min={1}
          step="1"
          required
          defaultValue={
            payment.paid_amount_minor != null
              ? Math.round(payment.paid_amount_minor / 100)
              : Math.round(payment.expected_amount_minor / 100)
          }
        />
      </Field>
      <Field label="UPI / bank reference (optional)" htmlFor="transaction_ref">
        <Input
          id="transaction_ref"
          name="transaction_ref"
          defaultValue={payment.transaction_ref ?? ""}
        />
      </Field>
      <TransferDateTimeField />
      <Field
        label="Payment screenshot"
        htmlFor="proof"
        hint="JPEG, PNG, or WebP. Max 5 MB. Use the camera or a saved image."
      >
        <Input id="proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Submit proof"}
      </Button>
      <Alert state={state} />
    </form>
  );
}
