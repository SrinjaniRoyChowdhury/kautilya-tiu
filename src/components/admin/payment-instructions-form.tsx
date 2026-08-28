"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PaymentQrImage } from "@/components/pay/payment-qr-image";
import { updatePaymentInstructionsAction, type PaymentState } from "@/app/actions/payments";
import type { PaymentInstructions } from "@/types";

export function PaymentInstructionsForm({
  editionId,
  instructions,
}: {
  editionId: string;
  instructions: PaymentInstructions | null;
}) {
  const action = updatePaymentInstructionsAction.bind(null, editionId);
  const [state, formAction, pending] = useActionState(action, {} as PaymentState);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="UPI ID" htmlFor="upi_id">
        <Input id="upi_id" name="upi_id" defaultValue={instructions?.upi_id ?? ""} />
      </Field>
      <Field label="Account name" htmlFor="account_name">
        <Input
          id="account_name"
          name="account_name"
          defaultValue={instructions?.account_name ?? ""}
        />
      </Field>
      <Field label="Bank" htmlFor="bank_name">
        <Input id="bank_name" name="bank_name" defaultValue={instructions?.bank_name ?? ""} />
      </Field>
      <Field label="Account number" htmlFor="account_number">
        <Input
          id="account_number"
          name="account_number"
          defaultValue={instructions?.account_number ?? ""}
        />
      </Field>
      <Field label="IFSC" htmlFor="ifsc">
        <Input id="ifsc" name="ifsc" defaultValue={instructions?.ifsc ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <Field
          label="UPI QR image"
          htmlFor="upi_qr"
          hint="Delegates see this on payment details. You can also change it from Admin → Payments."
        >
          <Input id="upi_qr" name="upi_qr" type="file" accept="image/jpeg,image/png,image/webp" />
        </Field>
        {instructions?.upi_qr_image_key ? (
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <PaymentQrImage
              editionId={editionId}
              imageKey={instructions.upi_qr_image_key}
              alt="Current receiving QR"
              className="h-36 w-36 rounded-sm border border-gold-700/25 bg-parchment-50 object-contain p-1"
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" name="remove_qr" />
              Remove the current QR
            </label>
          </div>
        ) : null}
      </div>
      <div className="sm:col-span-2">
        <Field label="Notes shown to payers" htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={instructions?.notes ?? ""} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save payment instructions"}
        </Button>
        <ActionFeedback error={state.error} success={state.success} />
      </div>
    </form>
  );
}
