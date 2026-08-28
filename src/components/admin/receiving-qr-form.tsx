"use client";

import { useActionState } from "react";
import { updatePaymentQrAction, type PaymentState } from "@/app/actions/payments";
import { PaymentQrImage } from "@/components/pay/payment-qr-image";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";

export function ReceivingQrForm({
  editionId,
  imageKey,
  canEdit,
  compact = false,
}: {
  editionId: string;
  imageKey?: string | null;
  canEdit: boolean;
  compact?: boolean;
}) {
  const action = updatePaymentQrAction.bind(null, editionId);
  const [state, formAction, pending] = useActionState(action, {} as PaymentState);

  return (
    <form action={formAction} className={compact ? "grid gap-3 sm:grid-cols-[auto_1fr]" : "grid gap-3"}>
      <div>
        {imageKey ? (
          <PaymentQrImage
            editionId={editionId}
            imageKey={imageKey}
            alt="Current receiving QR"
            className="h-36 w-36 rounded-sm border border-gold-700/25 bg-parchment-50 object-contain p-1"
          />
        ) : (
          <p className="text-sm text-ink-muted">No receiving QR uploaded yet.</p>
        )}
      </div>
      {canEdit ? (
        <div className="grid gap-3">
          <Field
            label="QR image"
            htmlFor={`upi_qr-${editionId}`}
            hint="JPEG, PNG, or WebP. Delegates see this on payment details."
          >
            <Input
              id={`upi_qr-${editionId}`}
              name="upi_qr"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
          </Field>
          {imageKey ? (
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" name="remove_qr" />
              Remove the current QR
            </label>
          ) : null}
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : imageKey ? "Replace QR" : "Upload QR"}
            </Button>
            <ActionFeedback error={state.error} success={state.success} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Only an admin can change this image.</p>
      )}
    </form>
  );
}
