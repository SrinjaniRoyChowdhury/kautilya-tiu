"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { createEditionAction, updateEditionAction, type FormState } from "@/app/actions/editions";
import { createCommitteeAction, updateCommitteeAction } from "@/app/actions/committees";
import type { Committee, Edition } from "@/types";

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditionForm({ edition }: { edition?: Edition }) {
  const action = edition
    ? updateEditionAction.bind(null, edition.id)
    : createEditionAction;
  const [state, formAction, pending] = useActionState(action, {} as FormState);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {state.error ? (
        <p className="sm:col-span-2 rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="sm:col-span-2 rounded-sm bg-parchment-200 px-3 py-2 text-sm" role="status">
          {state.success}
        </p>
      ) : null}
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required defaultValue={edition?.name} />
      </Field>
      <Field label="Year" htmlFor="year">
        <Input id="year" name="year" type="number" required defaultValue={edition?.year ?? 2026} />
      </Field>
      <Field label="Slug" htmlFor="slug" hint="Public URL segment, e.g. 2026">
        <Input id="slug" name="slug" defaultValue={edition?.slug} />
      </Field>
      <Field label="Theme" htmlFor="theme">
        <Input id="theme" name="theme" defaultValue={edition?.theme ?? ""} />
      </Field>
      <Field label="Start date" htmlFor="start_date">
        <Input id="start_date" name="start_date" type="date" defaultValue={edition?.start_date ?? ""} />
      </Field>
      <Field label="End date" htmlFor="end_date">
        <Input id="end_date" name="end_date" type="date" defaultValue={edition?.end_date ?? ""} />
      </Field>
      <Field label="Registration opens" htmlFor="registration_open_at">
        <Input
          id="registration_open_at"
          name="registration_open_at"
          type="datetime-local"
          defaultValue={toLocalInput(edition?.registration_open_at)}
        />
      </Field>
      <Field label="Registration closes" htmlFor="registration_close_at">
        <Input
          id="registration_close_at"
          name="registration_close_at"
          type="datetime-local"
          defaultValue={toLocalInput(edition?.registration_close_at)}
        />
      </Field>
      <Field label="Status" htmlFor="status">
        <Select id="status" name="status" defaultValue={edition?.status ?? "DRAFT"}>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
      </Field>
      <label className="flex items-center gap-2 self-end text-sm">
        <input
          type="checkbox"
          name="is_public_active"
          defaultChecked={edition?.is_public_active}
          className="h-4 w-4"
        />
        Public active edition (registration CTA points here)
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : edition ? "Save edition" : "Create edition"}
        </Button>
      </div>
    </form>
  );
}

export function CommitteeForm({
  editions,
  committee,
  defaultEditionId,
}: {
  editions: Pick<Edition, "id" | "name">[];
  committee?: Committee;
  defaultEditionId?: string;
}) {
  const action = committee
    ? updateCommitteeAction.bind(null, committee.id)
    : createCommitteeAction;
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const ebDefault = committee?.eb_json?.map((m) => `${m.name} | ${m.title}`).join("\n") ?? "";

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {state.error ? (
        <p className="sm:col-span-2 rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="sm:col-span-2 rounded-sm bg-parchment-200 px-3 py-2 text-sm" role="status">
          {state.success}
        </p>
      ) : null}
      <Field label="Edition" htmlFor="edition_id">
        <Select
          id="edition_id"
          name="edition_id"
          required
          defaultValue={committee?.edition_id ?? defaultEditionId}
        >
          {editions.map((edition) => (
            <option key={edition.id} value={edition.id}>
              {edition.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Short name" htmlFor="short_name" hint="e.g. UNSC">
        <Input id="short_name" name="short_name" required defaultValue={committee?.short_name} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Full name" htmlFor="name">
          <Input id="name" name="name" required defaultValue={committee?.name} />
        </Field>
      </div>
      <Field label="Slug" htmlFor="slug">
        <Input id="slug" name="slug" defaultValue={committee?.slug} />
      </Field>
      <Field
        label="Fee (₹)"
        htmlFor="fee_rupees"
        hint="Stored internally as paise. Changing this does not rewrite old registrations."
      >
        <Input
          id="fee_rupees"
          name="fee_rupees"
          type="number"
          min={0}
          step="1"
          required
          defaultValue={committee ? committee.fee_minor / 100 : 1500}
        />
      </Field>
      <Field label="Status" htmlFor="status">
        <Select id="status" name="status" defaultValue={committee?.status ?? "OPEN"}>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
          <option value="HIDDEN">Hidden</option>
        </Select>
      </Field>
      <Field label="Display order" htmlFor="display_order">
        <Input
          id="display_order"
          name="display_order"
          type="number"
          defaultValue={committee?.display_order ?? 0}
        />
      </Field>
      <Field label="Rules URL" htmlFor="rules_url">
        <Input id="rules_url" name="rules_url" type="url" defaultValue={committee?.rules_url ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description" htmlFor="description" hint="Plain text. Line breaks are kept.">
          <Textarea id="description" name="description" defaultValue={committee?.description ?? ""} />
        </Field>
      </div>
      <Field label="Executive board" htmlFor="eb_json" hint="One per line: Name | Title">
        <Textarea id="eb_json" name="eb_json" defaultValue={ebDefault} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : committee ? "Save committee" : "Create committee"}
        </Button>
      </div>
    </form>
  );
}
