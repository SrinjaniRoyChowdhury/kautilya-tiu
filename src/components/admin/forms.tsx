"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { createEditionAction, updateEditionAction, type FormState } from "@/app/actions/editions";
import {
  createCommitteeAction,
  updateCommitteeAction,
  updateCommitteeContentAction,
  type FormState as CommitteeFormState,
} from "@/app/actions/committees";
import { PHASE_KINDS, PHASE_LABELS } from "@/lib/phases";
import { COMMITTEE_CARD_BACKGROUND_HINT } from "@/lib/committee-card-background";
import { COMMITTEE_LOGO_HINT } from "@/lib/committee-logo";
import { SquareImageField } from "@/components/ui/square-image-field";
import type { Committee, CommitteePhaseFee, Edition, PrizeMoneyEntry } from "@/types";

function CommitteeLogoField({
  committee,
  readOnly,
  showRemove,
}: {
  committee?: Committee;
  readOnly?: boolean;
  showRemove?: boolean;
}) {
  return (
    <div className="sm:col-span-2">
      <SquareImageField
        label="Logo"
        htmlFor="logo_file"
        fileName="logo_file"
        removeName="remove_logo"
        currentUrl={committee?.logo_url}
        readOnly={readOnly}
        showRemove={showRemove}
        hint={COMMITTEE_LOGO_HINT}
        previewClassName="h-20 w-20 rounded-sm border border-gold-700/25 bg-parchment-100 object-contain p-1"
      />
    </div>
  );
}

function CommitteeCardBackgroundField({
  committee,
  readOnly,
  showRemove,
}: {
  committee?: Committee;
  readOnly?: boolean;
  showRemove?: boolean;
}) {
  return (
    <div className="sm:col-span-2">
      <SquareImageField
        label="Card background"
        htmlFor="card_background_file"
        fileName="card_background_file"
        removeName="remove_card_background"
        currentUrl={committee?.card_background_url}
        readOnly={readOnly}
        showRemove={showRemove}
        hint={COMMITTEE_CARD_BACKGROUND_HINT}
        previewClassName="h-28 w-28 rounded-sm border border-gold-700/25 bg-parchment-100 object-cover p-0.5"
      />
    </div>
  );
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type PrizeDraft = { key: string; category: string; amount: string };

function emptyPrizeRow(): PrizeDraft {
  return { key: crypto.randomUUID(), category: "", amount: "" };
}

function prizesToDraft(
  prizes: PrizeMoneyEntry[] | undefined,
  draftRows?: { category: string; amount: string }[],
): PrizeDraft[] {
  if (draftRows?.length) {
    return draftRows.map((row) => ({
      key: crypto.randomUUID(),
      category: row.category,
      amount: row.amount,
    }));
  }
  if (!prizes?.length) return [emptyPrizeRow()];
  return prizes.map((prize) => ({
    key: crypto.randomUUID(),
    category: prize.category,
    amount: String(prize.amount_minor / 100),
  }));
}

function CommitteePrizeMoneyField({
  committee,
  draft,
  readOnly,
}: {
  committee?: Committee;
  draft?: CommitteeFormState["values"];
  readOnly?: boolean;
}) {
  const [rows, setRows] = useState(() =>
    prizesToDraft(committee?.prize_money_json, draft?.prize_rows),
  );
  const showPrizeMoney = draft?.show_prize_money ?? committee?.show_prize_money ?? false;

  return (
    <fieldset className="sm:col-span-2 grid gap-3">
      <legend className="text-sm font-medium">Prize money</legend>
      <p className="text-xs text-ink-muted">
        Optional prize categories and amounts shown on the public committee page when enabled.
      </p>
      <label className="inline-flex w-fit items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="show_prize_money"
          defaultChecked={showPrizeMoney}
          disabled={readOnly}
          className="h-4 w-4 shrink-0"
        />
        Show prize money on public page
      </label>
      <input type="hidden" name="prize_count" value={rows.length} />
      <ul className="grid gap-3">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className="grid gap-3 rounded-sm border border-gold-700/20 p-3 sm:grid-cols-[1fr_10rem_auto]"
          >
            <Field label="Category" htmlFor={`prize-category-${row.key}`}>
              <Input
                id={`prize-category-${row.key}`}
                name={`prize_category_${index}`}
                defaultValue={row.category}
                placeholder="e.g. Best delegate"
                disabled={readOnly}
              />
            </Field>
            <Field label="Amount (₹)" htmlFor={`prize-amount-${row.key}`}>
              <Input
                id={`prize-amount-${row.key}`}
                name={`prize_amount_${index}`}
                type="number"
                min={0}
                step="1"
                defaultValue={row.amount}
                placeholder="5000"
                disabled={readOnly}
              />
            </Field>
            {!readOnly && rows.length > 1 ? (
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {!readOnly ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => setRows((current) => [...current, emptyPrizeRow()])}>
          Add prize
        </Button>
      ) : null}
    </fieldset>
  );
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
  mode = "full",
}: {
  editions: Pick<Edition, "id" | "name">[];
  committee?: Committee;
  defaultEditionId?: string;
  fees?: CommitteePhaseFee[];
  mode?: "full" | "content" | "view";
}) {
  const contentOnly = mode === "content";
  const readOnly = mode === "view";
  const isCreate = !committee;
  const action = contentOnly
    ? updateCommitteeContentAction.bind(null, committee?.id ?? "")
    : committee
      ? updateCommitteeAction.bind(null, committee.id)
      : createCommitteeAction;
  const [state, formAction, pending] = useActionState(action, {} as CommitteeFormState);
  const draft = state.values;
  const formKey = state.formKey ?? "initial";
  const feeByKind = Object.fromEntries(
    fees.filter((row) => row.kind).map((row) => [row.kind, row]),
  ) as Record<string, CommitteePhaseFee>;

  if (contentOnly && committee) {
    return (
      <form action={readOnly ? undefined : formAction} className="grid gap-4 sm:grid-cols-2">
        <Field label="Short name" htmlFor="short_name" hint="e.g. UNSC. Shown in lists; the public URL is generated from this.">
          <Input
            id="short_name"
            name="short_name"
            required
            defaultValue={committee.short_name}
            disabled={readOnly}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Full name" htmlFor="name">
            <Input id="name" name="name" required defaultValue={committee.name} disabled={readOnly} />
          </Field>
        </div>
        <CommitteeLogoField committee={committee} readOnly={readOnly} showRemove />
        <CommitteeCardBackgroundField committee={committee} readOnly={readOnly} showRemove />
        <div className="sm:col-span-2">
          <Field label="Description" htmlFor="description" hint="Plain text. Line breaks are kept.">
            <Textarea id="description" name="description" defaultValue={committee.description ?? ""} disabled={readOnly} />
          </Field>
        </div>
        {readOnly ? null : (
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save public details"}
            </Button>
            <ActionFeedback error={state.error} success={state.success} />
          </div>
        )}
      </form>
    );
  }

  return (
      <form
        key={formKey}
        action={readOnly ? undefined : formAction}
        className="grid gap-4 sm:grid-cols-2"
      >
      <Field label="Edition" htmlFor="edition_id">
        <Select
          id="edition_id"
          name="edition_id"
          required
          disabled={readOnly}
          defaultValue={draft?.edition_id ?? committee?.edition_id ?? defaultEditionId}
        >
          {editions.map((edition) => (
            <option key={edition.id} value={edition.id}>
              {edition.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Short name" htmlFor="short_name" hint="e.g. UNSC. The public page URL is generated automatically from this.">
        <Input
          id="short_name"
          name="short_name"
          required
          defaultValue={draft?.short_name ?? committee?.short_name ?? ""}
          disabled={readOnly}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Full name" htmlFor="name">
          <Input
            id="name"
            name="name"
            required
            defaultValue={draft?.name ?? committee?.name ?? ""}
            disabled={readOnly}
          />
        </Field>
      </div>
      <Field label="Status" htmlFor="status">
        <Select
          id="status"
          name="status"
          defaultValue={draft?.status ?? committee?.status ?? "OPEN"}
          disabled={readOnly}
        >
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
        <div className="inline-flex w-fit items-center gap-2 text-sm">
          <input
            id="allows_single_del"
            type="checkbox"
            name="allows_single_del"
            defaultChecked={draft?.allows_single_del ?? committee?.allows_single_del ?? true}
            disabled={readOnly}
            className="h-4 w-4 shrink-0"
          />
          <label htmlFor="allows_single_del" className="cursor-pointer select-none">
            Allow single delegation
          </label>
        </div>
        <div className="inline-flex w-fit items-center gap-2 text-sm">
          <input
            id="allows_double_del"
            type="checkbox"
            name="allows_double_del"
            defaultChecked={draft?.allows_double_del ?? committee?.allows_double_del ?? false}
            disabled={readOnly}
            className="h-4 w-4 shrink-0"
          />
          <label htmlFor="allows_double_del" className="cursor-pointer select-none">
            Allow double delegation
          </label>
        </div>
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
              const draftFees = draft?.phase_fees?.[kind];
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
                      disabled={readOnly}
                      defaultValue={
                        draftFees?.single ??
                        (row ? row.single_fee_minor / 100 : fallback)
                      }
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
                      disabled={readOnly}
                      defaultValue={
                        draftFees?.double ??
                        (row ? row.double_fee_minor / 100 : fallback)
                      }
                      className="h-9 py-1.5"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <CommitteePrizeMoneyField committee={committee} draft={draft} readOnly={readOnly} />
      <Field label="Display order" htmlFor="display_order">
        <Input
          id="display_order"
          name="display_order"
          type="number"
          disabled={readOnly}
          defaultValue={draft?.display_order ?? committee?.display_order ?? 0}
        />
      </Field>
      <CommitteeLogoField committee={committee} readOnly={readOnly} showRemove={!isCreate} />
      <CommitteeCardBackgroundField committee={committee} readOnly={readOnly} showRemove={!isCreate} />
      {!isCreate ? (
        <Field label="Rules URL" htmlFor="rules_url">
          <Input id="rules_url" name="rules_url" type="url" defaultValue={committee?.rules_url ?? ""} disabled={readOnly} />
        </Field>
      ) : null}
      <div className="sm:col-span-2">
        <Field label="Description" htmlFor="description" hint="Plain text. Line breaks are kept.">
          <Textarea
            id="description"
            name="description"
            defaultValue={draft?.description ?? committee?.description ?? ""}
            disabled={readOnly}
          />
        </Field>
      </div>
      {readOnly ? null : (
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : committee ? "Save committee" : "Create committee"}
        </Button>
        <ActionFeedback error={state.error} success={state.success} />
      </div>
      )}
    </form>
  );
}
