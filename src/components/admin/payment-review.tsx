"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import {
  manualConfirmPaymentAction,
  rejectPaymentAction,
  verifyPaymentAction,
  type AdminPaymentState,
} from "@/app/actions/admin-payments";
import { formatDateTime12h, formatInrFromMinor } from "@/lib/format";
import { AMOUNT_FLAG_COPY, participantEmail, participantName, participantResolution } from "@/lib/payments";
import type { PaymentWithParticipants } from "@/types";

export function PaymentReviewActions({
  payment,
  canVerify,
  proofHref,
}: {
  payment: PaymentWithParticipants;
  canVerify: boolean;
  proofHref?: string | null;
}) {
  const verify = verifyPaymentAction.bind(null, payment.id);
  const manualConfirm = manualConfirmPaymentAction.bind(null, payment.id);
  const reject = rejectPaymentAction.bind(null, payment.id);
  const [verifyState, verifyAction, verifyPending] = useActionState(verify, {} as AdminPaymentState);
  const [confirmState, confirmAction, confirmPending] = useActionState(
    manualConfirm,
    {} as AdminPaymentState,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(reject, {} as AdminPaymentState);
  const closed = payment.status === "VERIFIED" || payment.status === "CANCELLED";
  const reviewable =
    !closed && payment.status !== "REJECTED" && (payment.status === "UNDER_REVIEW" || payment.status === "PENDING");
  const difference =
    payment.paid_amount_minor != null
      ? payment.paid_amount_minor - payment.expected_amount_minor
      : null;
  const busy = verifyPending || confirmPending || rejectPending;

  return (
    <div className="grid gap-4">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-widest text-gold-700">Expected</dt>
          <dd className="font-serif text-2xl">{formatInrFromMinor(payment.expected_amount_minor)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-gold-700">Declared paid</dt>
          <dd className="font-serif text-2xl">
            {payment.paid_amount_minor != null ? formatInrFromMinor(payment.paid_amount_minor) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-gold-700">Difference</dt>
          <dd>
            {difference == null ? "—" : formatInrFromMinor(Math.abs(difference))}{" "}
            {AMOUNT_FLAG_COPY[payment.amount_flag]}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-gold-700">Reference</dt>
          <dd>{payment.transaction_ref ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-widest text-gold-700">Transaction date & time</dt>
          <dd className="font-medium">{formatDateTime12h(payment.paid_at)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-widest text-gold-700">Screenshot</dt>
          <dd>
            {proofHref ? (
              <a href={proofHref} className="text-gold-700 hover:underline" target="_blank" rel="noreferrer">
                Open attached screenshot
              </a>
            ) : (
              "Not uploaded"
            )}
          </dd>
        </div>
      </dl>
      {payment.rejection_reason ? (
        <p className="text-sm text-red-800">Last rejection: {payment.rejection_reason}</p>
      ) : null}
      <ul className="grid gap-2">
        {payment.payment_participants.map((row) => (
          <li key={row.id} className="text-sm">
            <span className="font-medium">{participantName(row)}</span> · {participantEmail(row)} ·{" "}
            {participantResolution(row)} · {formatInrFromMinor(row.amount_minor)}
          </li>
        ))}
      </ul>

      {canVerify && reviewable ? (
        <form action={confirmAction} className="grid gap-3 rounded-sm border border-gold-700/25 bg-parchment-100/50 p-4">
          <p className="font-medium text-gold-800">Manually confirm payment</p>
          <p className="text-xs text-ink-muted">
            Upload the payment screenshot, then confirm. Screenshot upload is required even if the
            payer already attached one.
          </p>
          <Field
            label="Payment screenshot"
            htmlFor={`admin-proof-${payment.id}`}
            hint="JPEG, PNG, or WebP · max 5 MB"
          >
            <Input
              id={`admin-proof-${payment.id}`}
              name="proof"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {confirmPending ? "Confirming…" : "Confirm with screenshot"}
          </Button>
          <ActionFeedback error={confirmState.error} success={confirmState.success} />
        </form>
      ) : null}

      {canVerify && reviewable && payment.status === "UNDER_REVIEW" && proofHref ? (
        <div className="flex flex-wrap gap-3">
          <form action={verifyAction}>
            <Button type="submit" variant="secondary" disabled={busy}>
              {verifyPending ? "Verifying…" : "Verify existing screenshot"}
            </Button>
            <ActionFeedback error={verifyState.error} success={verifyState.success} />
          </form>
        </div>
      ) : null}

      {canVerify && !closed && payment.status !== "REJECTED" ? (
        <form action={rejectAction} className="grid gap-3">
          <Field label="Reject with reason" htmlFor="reason">
            <Textarea id="reason" name="reason" required minLength={3} placeholder="amount short" />
          </Field>
          <Button type="submit" variant="secondary" disabled={busy}>
            {rejectPending ? "Rejecting…" : "Reject"}
          </Button>
          <ActionFeedback error={rejectState.error} success={rejectState.success} />
        </form>
      ) : null}
    </div>
  );
}
