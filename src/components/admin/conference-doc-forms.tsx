"use client";

import { useActionState } from "react";
import {
  clearConferenceDocLinkAction,
  saveConferenceDocLinksAction,
  type DocsState,
} from "@/app/actions/docs";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { DOC_LABELS, type DocKind, type DocLinks } from "@/lib/docs";

export function ConferenceDocLinksForm({ links }: { links: DocLinks }) {
  const [state, action, pending] = useActionState(saveConferenceDocLinksAction, {} as DocsState);
  return (
    <form action={action} className="grid gap-4">
      <Field
        label="Rulebook link"
        htmlFor="rulebook_url"
        hint="Google Doc, Drive, or any public URL. Shown on /rulebook and registration."
      >
        <Input
          id="rulebook_url"
          name="rulebook_url"
          type="url"
          defaultValue={links.rulebook ?? ""}
          placeholder="https://…"
        />
      </Field>
      <Field
        label="Guidelines link"
        htmlFor="guidelines_url"
        hint="Google Doc, Drive, or any public URL."
      >
        <Input
          id="guidelines_url"
          name="guidelines_url"
          type="url"
          defaultValue={links.guidelines ?? ""}
          placeholder="https://…"
        />
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save links"}
        </Button>
        <ActionFeedback error={state.error} success={state.success} />
      </div>
    </form>
  );
}

export function ClearConferenceDocLinkButton({ kind }: { kind: DocKind }) {
  const [state, action, pending] = useActionState(clearConferenceDocLinkAction, {} as DocsState);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="kind" value={kind} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Clearing…" : `Clear ${DOC_LABELS[kind]}`}
      </Button>
      <ActionFeedback error={state.error} className="text-xs" />
    </form>
  );
}

export function PublishedDocLinks({ links }: { links: DocLinks }) {
  const rows = (Object.entries(links) as Array<[DocKind, string | null]>).filter(([, url]) =>
    Boolean(url),
  );
  if (!rows.length) {
    return <p className="mt-4 text-sm text-ink-muted">No links saved yet.</p>;
  }
  return (
    <ul className="mt-4 grid gap-3">
      {rows.map(([kind, url]) => (
        <li key={kind} className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="min-w-0">
            <span className="font-medium">{DOC_LABELS[kind]}</span>
            <a
              href={url!}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block truncate text-gold-700 hover:underline"
            >
              {url}
            </a>
          </span>
          <ClearConferenceDocLinkButton kind={kind} />
        </li>
      ))}
    </ul>
  );
}
