"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { acceptConferenceRulesAction, type DocsState } from "@/app/actions/docs";
import { ConferenceDocCards } from "@/components/public/doc-cards";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import type { DocKind } from "@/lib/docs";

export function RulesAcceptance({
  registrationId,
  published,
}: {
  registrationId: string;
  published: Record<DocKind, boolean>;
}) {
  const [state, action, pending] = useActionState(acceptConferenceRulesAction, {} as DocsState);
  const [readRulebook, setReadRulebook] = useState(false);
  const [readGuidelines, setReadGuidelines] = useState(false);
  const ready = published.rulebook && published.guidelines;
  const bothChecked = readRulebook && readGuidelines;

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
        {!ready ? (
          <p className="text-sm text-ink-muted">
            Both PDFs must be published before you can continue. You can still tick the boxes once they
            are live.
          </p>
        ) : null}
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="read_rulebook"
            value="on"
            checked={readRulebook}
            onChange={(event) => setReadRulebook(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#8c6828]"
          />
          I have read the rulebook.
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="read_guidelines"
            value="on"
            checked={readGuidelines}
            onChange={(event) => setReadGuidelines(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#8c6828]"
          />
          I have read the guidelines.
        </label>
        <Button type="submit" disabled={pending || !ready || !bothChecked}>
          {pending ? "Saving…" : "I agree — continue to registration"}
        </Button>
        <ActionFeedback error={state.error} success={state.success} />
      </form>
    </div>
  );
}
