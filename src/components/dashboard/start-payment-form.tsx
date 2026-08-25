"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { DelegateEmailPicker } from "@/components/dashboard/delegate-email-picker";
import { startPaymentAction, type PaymentState } from "@/app/actions/payments";

export function StartPaymentForm({
  editionId,
  canIncludeSelf,
}: {
  editionId: string;
  canIncludeSelf: boolean;
}) {
  const action = startPaymentAction.bind(null, editionId);
  const [state, formAction, pending] = useActionState(action, {} as PaymentState);

  return (
    <form action={formAction} className="grid gap-4">
      {state.error ? (
        <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="include_self"
          defaultChecked={canIncludeSelf}
          disabled={!canIncludeSelf}
          className="mt-1 h-4 w-4"
        />
        <span>
          Pay for myself
          {!canIncludeSelf ? (
            <span className="block text-xs text-ink-muted">
              Submit your registration first so your fee is known, or search for other registered
              delegates below.
            </span>
          ) : null}
        </span>
      </label>
      <DelegateEmailPicker editionId={editionId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Starting…" : "Continue to payment details"}
      </Button>
    </form>
  );
}
