"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptConferenceRulesAction, type DocsState } from "@/app/actions/docs";
import { ConferenceDocCards } from "@/components/public/doc-cards";
import { Button } from "@/components/ui/button";
import type { DocKind } from "@/lib/docs";

export function RulesAcceptance({
  registrationId,
  published,
}: {
  registrationId: string;
  published: Record<DocKind, boolean>;
}) {
  const [state, action, pending] = useActionState(acceptConferenceRulesAction, {} as DocsState);
  const ready = published.rulebook && published.guidelines;

  return (
    <div className="grid gap-8">
      <p className="text-sm text-ink-muted">
        Open the{" "}
        <Link href="/rulebook" className="text-gold-700 hover:underline">
          rulebook and guidelines
        </Link>{" "}
        first, the same way you would accept terms and conditions. Registration stays closed until
        you confirm both.
      </p>
      <ConferenceDocCards published={published} />
      <form action={action} className="grid gap-4 border-t border-gold-700/15 pt-6">
        <input type="hidden" name="registration_id" value={registrationId} />
        {state.error ? (
          <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {state.error}
          </p>
        ) : null}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="read_rulebook" className="mt-1" required disabled={!ready} />
          I have read the rulebook.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="read_guidelines" className="mt-1" required disabled={!ready} />
          I have read the guidelines.
        </label>
        <Button type="submit" disabled={pending || !ready}>
          {pending ? "Saving…" : "I agree — continue to registration"}
        </Button>
      </form>
    </div>
  );
}
