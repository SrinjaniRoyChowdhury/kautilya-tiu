"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { createEditionAction, updateEditionAction, type FormState } from "@/app/actions/editions";
import { createCommitteeAction, updateCommitteeAction } from "@/app/actions/committees";
import { PHASE_KINDS, PHASE_LABELS } from "@/lib/phases";
import type { Committee, CommitteePhaseFee, Edition } from "@/types";

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
        <ActionFeedback error={state.error} success={state.success} />
      </div>
    </form>
  );
}

export function CommitteeForm({
  editions,
  committee,
  defaultEditionId,
  fees = [],
}: {
  editions: Pick<Edition, "id" | "name">[];
  committee?: Committee;
  defaultEditionId?: string;
  fees?: CommitteePhaseFee[];
}) {
  const action = committee
    ? updateCommitteeAction.bind(null, committee.id)
    : createCommitteeAction;
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const ebDefault = committee?.eb_json?.map((m) => `${m.name} | ${m.title}`).join("\n") ?? "";
  const feeByKind = Object.fromEntries(
    fees.filter((row) => row.kind).map((row) => [row.kind, row]),
  ) as Record<string, CommitteePhaseFee>;

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
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
      <Field label="Status" htmlFor="status">
        <Select id="status" name="status" defaultValue={committee?.status ?? "OPEN"}>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
          <option value="HIDDEN">Hidden</option>
        </Select>
      </Field>
      <fieldset className="sm:col-span-2 grid gap-2">
        <legend className="text-sm font-medium">Delegation type</legend>
        <p className="text-xs text-ink-muted">
          Double delegation uses one portfolio for two people. Fees for double del are set per phase
          below.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="allows_single_del"
            defaultChecked={committee?.allows_single_del ?? true}
            className="h-4 w-4"
          />
          Allow single delegation
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="allows_double_del"
            defaultChecked={committee?.allows_double_del ?? false}
            className="h-4 w-4"
          />
          Allow double delegation
        </label>
      </fieldset>
      <div className="sm:col-span-2 overflow-x-auto">
        <p className="mb-2 text-sm font-medium">Fees by registration phase (₹)</p>
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gold-700/25 text-xs uppercase tracking-wide text-gold-700">
              <th className="px-2 py-1.5">Phase</th>
              <th className="px-2 py-1.5">Single del</th>
              <th className="px-2 py-1.5">Double del</th>
            </tr>
          </thead>
          <tbody>
            {PHASE_KINDS.map((kind) => {
              const row = feeByKind[kind];
              const fallback = committee ? committee.fee_minor / 100 : 1500;
              return (
                <tr key={kind} className="border-b border-gold-700/10">
                  <td className="px-2 py-1.5">{PHASE_LABELS[kind]}</td>
                  <td className="px-2 py-1.5">
                    <Input
                      name={`fee_${kind}_single`}
                      type="number"
                      min={0}
                      step="1"
                      required
                      defaultValue={row ? row.single_fee_minor / 100 : fallback}
                      className="h-9 py-1.5"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      name={`fee_${kind}_double`}
                      type="number"
                      min={0}
                      step="1"
                      required
                      defaultValue={row ? row.double_fee_minor / 100 : fallback}
                      className="h-9 py-1.5"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
        <ActionFeedback error={state.error} success={state.success} />
      </div>
    </form>
  );
}
