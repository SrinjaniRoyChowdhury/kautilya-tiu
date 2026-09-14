"use client";

import { useActionState } from "react";
import { updatePortfolioMatrixUrlAction, type FormState } from "@/app/actions/committees";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";

export function PortfolioMatrixUrlForm({
  editionId,
  editionName,
  currentUrl,
}: {
  editionId: string;
  editionName: string;
  currentUrl?: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updatePortfolioMatrixUrlAction,
    {} as FormState,
  );
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <input type="hidden" name="edition_id" value={editionId} />
      <Field
        label={`Portfolio Matrix link · ${editionName}`}
        htmlFor={`portfolio-matrix-${editionId}`}
        hint="Google Sheet shown to delegates on the registration form."
      >
        <Input
          id={`portfolio-matrix-${editionId}`}
          name="portfolio_matrix_url"
          type="url"
          defaultValue={currentUrl ?? ""}
          placeholder="https://docs.google.com/spreadsheets/..."
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save link"}
      </Button>
      <div className="sm:col-span-2">
        <ActionFeedback error={state.error} success={state.success} />
      </div>
    </form>
  );
}
