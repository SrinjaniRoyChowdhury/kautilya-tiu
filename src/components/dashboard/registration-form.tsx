"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Controller, useForm, useWatch, type Control, type Resolver, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { NameSuggestInput } from "@/components/ui/name-suggest";
import { registrationFormAction, type RegistrationState } from "@/app/actions/registrations";
import { MUN_EXPERIENCE_EXAMPLE, MUN_EXPERIENCE_FORMAT } from "@/lib/constants";
import {
  buildRegistrationSchema,
  isPreAllocationStatus,
  PRE_PAYMENT_STATUSES,
  preferencesToFormItems,
  SECTION_LABELS,
  seatsHeld,
  visibleRegistrationFields,
  type PreferenceFormItem,
  type RegistrationFormValues,
} from "@/lib/registration";
import { formatInrFromMinor, seatsRemaining } from "@/lib/format";
import { PHASE_LABELS } from "@/lib/phases";
import { PHONE_HINT, isParticipantPhoneField, phoneInputProps } from "@/lib/phone";
import type {
  Committee,
  FieldSection,
  Registration,
  RegistrationFieldDefinition,
  RegistrationFieldValue,
  RegistrationPreference,
} from "@/types";

const SECTION_ORDER: FieldSection[] = ["PERSONAL", "MUN_INFO", "FOOD", "ADDITIONAL"];

function defaultValues(
  fields: RegistrationFieldDefinition[],
  values: RegistrationFieldValue[],
  registration: Registration,
  preferences: RegistrationPreference[],
  preferredCommitteeId?: string,
): RegistrationFormValues {
  const byDef = new Map(values.map((row) => [row.field_definition_id, row]));
  const out: RegistrationFormValues = {
    food_preference: registration.food_preference ?? ("" as RegistrationFormValues["food_preference"]),
    collective_id: registration.collective_id ?? "",
    delegation_type: registration.delegation_type ?? "SINGLE",
    partner_email: registration.partner_email ?? "",
    preferences: preferencesToFormItems(preferences, preferredCommitteeId),
  };
  for (const field of fields) {
    const row = byDef.get(field.id);
    if (field.field_type === "multiselect") {
      out[field.field_key] = Array.isArray(row?.value_json) ? row.value_json : [];
    } else if (field.field_type === "boolean") {
      out[field.field_key] = row?.value_json === true || row?.value_text === "true";
    } else if (field.field_type === "number") {
      out[field.field_key] = row?.value_text ?? "";
    } else {
      out[field.field_key] = row?.value_text ?? "";
    }
  }
  return out;
}

function appendValues(fd: FormData, values: RegistrationFormValues, fields: RegistrationFieldDefinition[]) {
  fd.set("food_preference", String(values.food_preference ?? ""));
  fd.set("collective_id", String(values.collective_id ?? ""));
  fd.set("delegation_type", String(values.delegation_type ?? "SINGLE"));
  fd.set("partner_email", String(values.partner_email ?? ""));
  const prefs = Array.isArray(values.preferences) ? values.preferences : [];
  fd.set("preference_count", String(prefs.length));
  prefs.forEach((pref, index) => {
    fd.set(`preference_${index}_committee_id`, pref.committee_id);
    fd.set(`preference_${index}_portfolio_1`, String(pref.portfolio_1 ?? ""));
    fd.set(`preference_${index}_portfolio_2`, String(pref.portfolio_2 ?? ""));
  });
  for (const field of fields) {
    const raw = values[field.field_key];
    if (field.field_type === "multiselect") {
      const items = Array.isArray(raw) ? raw : [];
      for (const item of items) fd.append(`${field.field_key}[]`, String(item));
    } else if (field.field_type === "boolean") {
      if (raw) fd.set(field.field_key, "true");
    } else if (raw != null) {
      fd.set(field.field_key, String(raw));
    }
  }
}

export function RegistrationForm({
  editionId,
  registration,
  fields,
  committees,
  values,
  collectives,
  institutions,
  preferences,
  preferredCommitteeId,
  paymentLocked = false,
  publishedDocs,
  portfolioMatrixUrl,
}: {
  editionId: string;
  registration: Registration;
  fields: RegistrationFieldDefinition[];
  committees: Committee[];
  values: RegistrationFieldValue[];
  collectives: { id: string; name: string }[];
  institutions: { id: string; name: string }[];
  preferences: RegistrationPreference[];
  preferredCommitteeId?: string;
  paymentLocked?: boolean;
  publishedDocs?: { rulebook?: string | null; guidelines?: string | null };
  portfolioMatrixUrl?: string | null;
}) {
  const visibleFields = useMemo(() => visibleRegistrationFields(fields), [fields]);
  const pairLocked = registration.is_pair_lead === false;
  const allocated = Boolean(registration.committee_id) && !isPreAllocationStatus(registration.status);
  const editable =
    (PRE_PAYMENT_STATUSES as readonly string[]).includes(registration.status) && !paymentLocked;
  const committeeEditable = editable && isPreAllocationStatus(registration.status);
  const specialCrisisIds = useMemo(
    () =>
      new Set(
        committees.filter((item) => item.is_special_crisis).map((item) => item.id),
      ),
    [committees],
  );
  const schema = useMemo(
    () =>
      buildRegistrationSchema(visibleFields, {
        requirePreferences: !pairLocked,
        specialCrisisCommitteeIds: specialCrisisIds,
      }),
    [visibleFields, pairLocked, specialCrisisIds],
  );
  const [state, formAction, actionPending] = useActionState(
    registrationFormAction,
    {} as RegistrationState,
  );
  const [pending, startTransition] = useTransition();
  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<RegistrationFormValues>,
    defaultValues: defaultValues(visibleFields, values, registration, preferences, preferredCommitteeId),
  });

  const busy = pending || actionPending;
  const holdsSeat =
    allocated && registration.status !== "DRAFT" && registration.status !== "CANCELLED";

  const [readRulebook, setReadRulebook] = useState(Boolean(registration.accepted_rules_at));
  const [readGuidelines, setReadGuidelines] = useState(Boolean(registration.accepted_rules_at));
  const bothChecked = readRulebook && readGuidelines;

  function dispatch(intent: "draft" | "submit", data: RegistrationFormValues) {
    const prefs = Array.isArray(data.preferences) ? data.preferences : [];
    const selected = prefs
      .map((pref) => committees.find((item) => item.id === pref.committee_id))
      .filter((item): item is Committee => Boolean(item));
    const allDouble = selected.length > 0 && selected.every((item) => item.allows_double_del && !item.allows_single_del);
    const noneDouble = selected.length > 0 && selected.every((item) => !item.allows_double_del);
    if (allDouble) data.delegation_type = "DOUBLE";
    if (noneDouble) data.delegation_type = "SINGLE";
    const fd = new FormData();
    fd.set("intent", intent);
    fd.set("registration_id", registration.id);
    fd.set("edition_id", editionId);
    if (intent === "submit") {
      fd.set("read_rulebook", readRulebook ? "on" : "off");
      fd.set("read_guidelines", readGuidelines ? "on" : "off");
    }
    appendValues(fd, data, visibleFields);
    startTransition(() => formAction(fd));
  }

  const grouped = SECTION_ORDER.map((section) => ({
    section,
    fields: visibleFields.filter((field) => field.section === section),
  })).filter((group) => group.fields.length > 0);
  const collectiveId = String(useWatch({ control: form.control, name: "collective_id" }) ?? "");
  const selectedPrefs = (useWatch({ control: form.control, name: "preferences" }) ?? []) as PreferenceFormItem[];
  const delegationType = String(useWatch({ control: form.control, name: "delegation_type" }) ?? "SINGLE");
  const selectedCommittees = selectedPrefs
    .map((pref) => committees.find((item) => item.id === pref.committee_id))
    .filter((item): item is Committee => Boolean(item));
  const allowsBoth =
    selectedCommittees.some((item) => item.allows_single_del) &&
    selectedCommittees.some((item) => item.allows_double_del);
  const doubleOnly =
    selectedCommittees.length > 0 &&
    selectedCommittees.every((item) => item.allows_double_del && !item.allows_single_del);
  const allocatedCommittee = committees.find((item) => item.id === registration.committee_id);

  function toggleCommittee(committeeId: string) {
    const current = form.getValues("preferences") ?? [];
    const index = current.findIndex((pref) => pref.committee_id === committeeId);
    if (index >= 0) {
      form.setValue(
        "preferences",
        current.filter((_, i) => i !== index),
        { shouldDirty: true, shouldValidate: false },
      );
      return;
    }
    if (current.length >= 3) return;
    form.setValue(
      "preferences",
      [...current, { committee_id: committeeId, portfolio_1: "", portfolio_2: "" }],
      { shouldDirty: true, shouldValidate: false },
    );
  }

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={form.handleSubmit((data) => dispatch("submit", data))}
    >
      {pairLocked ? (
        <p className="rounded-sm bg-parchment-200 px-3 py-2 text-sm">
          You are the second delegate in a double delegation
          {registration.partner_name ? ` with ${registration.partner_name}` : ""}. Committee and
          portfolio are shared. Complete your own details and food preference. Payment by either of
          you confirms both; credentials, attendance, and meals stay individual.
        </p>
      ) : null}

      {allocated && allocatedCommittee ? (
        <div className="rounded-sm border border-gold-700/25 bg-parchment-100/70 p-4">
          <p className="text-xs uppercase tracking-widest text-gold-700">Allocated committee</p>
          <p className="mt-1 font-serif text-2xl">
            {allocatedCommittee.short_name} · {allocatedCommittee.name}
          </p>
          {registration.allocated_portfolio ? (
            <p className="mt-1 text-sm">Portfolio: {registration.allocated_portfolio}</p>
          ) : null}
          {registration.expected_fee_minor != null ? (
            <p className="mt-1 text-sm text-ink-muted">
              Amount due: {formatInrFromMinor(registration.expected_fee_minor)}
            </p>
          ) : null}
        </div>
      ) : null}

      <fieldset disabled={!committeeEditable || busy || pairLocked} className="grid gap-3">
        <legend className="mb-2 font-serif text-2xl text-gold-700">Committees</legend>
        <p className="text-sm text-ink-muted">
          Select 2 or 3 committees in order of preference. Click to add; click again to remove.
          Preference number appears as you choose.
        </p>
        {committees.map((committee) => {
          const prefIndex = selectedPrefs.findIndex((pref) => pref.committee_id === committee.id);
          const selected = prefIndex >= 0;
          const taken = seatsHeld(committee.occupied_count, committee.confirmed_count);
          const holdingThis = holdsSeat && registration.committee_id === committee.id;
          const remaining = seatsRemaining(committee.capacity, holdingThis ? Math.max(taken - 1, 0) : taken);
          const full = remaining <= 0 && committee.status === "OPEN" && !holdingThis && !selected;
          const closed = committee.status !== "OPEN";
          const phaseLabel = committee.current_phase_kind
            ? PHASE_LABELS[committee.current_phase_kind]
            : null;
          const atCap = !selected && selectedPrefs.length >= 3;
          const disabled = full || closed || pairLocked || atCap;
          return (
            <button
              key={committee.id}
              type="button"
              disabled={disabled && !selected}
              onClick={() => toggleCommittee(committee.id)}
              className={`frame-gold flex w-full items-start gap-3 rounded-sm p-4 text-left transition ${
                selected ? "bg-parchment-200" : "bg-parchment-50/90 hover:bg-parchment-100"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span
                className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border ${
                  selected ? "border-gold-700 bg-gold-700 text-[10px] text-parchment-50" : "border-gold-700/40"
                }`}
              >
                {selected ? prefIndex + 1 : ""}
              </span>
              <span className="flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-serif text-xl">
                    {committee.short_name} · {committee.name}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {selected ? (
                      <span className="rounded-sm bg-gold-700 px-2 py-0.5 text-xs font-medium text-parchment-50">
                        Preference {prefIndex + 1}
                      </span>
                    ) : null}
                    {committee.is_special_crisis ? (
                      <span className="rounded-sm border border-gold-700/40 px-2 py-0.5 text-xs text-gold-800">
                        Special crisis
                      </span>
                    ) : null}
                    <span className="text-sm text-ink-muted">
                      {formatInrFromMinor(committee.fee_minor)}
                      {committee.allows_double_del
                        ? ` · double ${formatInrFromMinor(committee.double_fee_minor ?? committee.fee_minor)}`
                        : ""}
                    </span>
                  </span>
                </span>
                <span className="mt-1 block text-xs text-ink-muted">
                  {closed
                    ? "Closed"
                    : full
                      ? "No delegations remaining"
                      : `${remaining} of ${committee.capacity} delegations remaining`}
                  {phaseLabel ? ` · ${phaseLabel}` : ""}
                </span>
              </span>
            </button>
          );
        })}
        {selectedPrefs.length < 2 ? (
          <p className="text-xs text-ink-muted">Select at least two committees.</p>
        ) : null}
      </fieldset>

      <fieldset disabled={!committeeEditable || busy || pairLocked} className="grid gap-4">
        <legend className="sr-only">Country / portfolio</legend>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-serif text-2xl text-gold-700">Country / portfolio</p>
            <p className="mt-1 text-sm text-ink-muted">
              For each preference, type 1 or 2 country/portfolio names. The two fields cannot be the
              same.
            </p>
          </div>
          {portfolioMatrixUrl ? (
            <a
              href={portfolioMatrixUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-sm border border-gold-700/50 bg-parchment-50 px-4 text-sm font-medium text-gold-700 hover:bg-parchment-200"
            >
              Portfolio Matrix
            </a>
          ) : null}
        </div>
        {selectedPrefs.length === 0 ? (
          <p className="text-sm text-ink-muted">Select committees above to add portfolio preferences.</p>
        ) : (
          selectedPrefs.map((pref, index) => {
            const committee = committees.find((item) => item.id === pref.committee_id);
            const isSpecial = Boolean(committee?.is_special_crisis);
            const p1Error = form.formState.errors.preferences?.[index]?.portfolio_1?.message as
              | string
              | undefined;
            const p2Error = form.formState.errors.preferences?.[index]?.portfolio_2?.message as
              | string
              | undefined;
            return (
              <div
                key={`${pref.committee_id}-${index}`}
                className="grid gap-3 rounded-sm border border-gold-700/20 bg-parchment-50/80 p-4"
              >
                <p className="font-serif text-lg">
                  Preference {index + 1}
                  {committee ? ` · ${committee.short_name}` : ""}
                  {isSpecial ? " · Special crisis" : ""}
                </p>
                {isSpecial ? (
                  <p className="text-sm text-ink-muted">
                    Special crisis committee portfolio will be assigned directly by the secretariat.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Portfolio 1"
                      htmlFor={`pref-${index}-p1`}
                      error={p1Error}
                      hint="Required"
                    >
                      <Input
                        id={`pref-${index}-p1`}
                        value={String(pref.portfolio_1 ?? "")}
                        placeholder="e.g. France"
                        onChange={(event) => {
                          const nextPrefs = [...selectedPrefs];
                          nextPrefs[index] = { ...nextPrefs[index], portfolio_1: event.target.value };
                          form.setValue("preferences", nextPrefs, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                      />
                    </Field>
                    <Field
                      label="Portfolio 2"
                      htmlFor={`pref-${index}-p2`}
                      error={p2Error}
                      hint="Optional"
                    >
                      <Input
                        id={`pref-${index}-p2`}
                        value={String(pref.portfolio_2 ?? "")}
                        placeholder="Optional second choice"
                        onChange={(event) => {
                          const nextPrefs = [...selectedPrefs];
                          nextPrefs[index] = { ...nextPrefs[index], portfolio_2: event.target.value };
                          form.setValue("preferences", nextPrefs, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                      />
                    </Field>
                  </div>
                )}
              </div>
            );
          })
        )}
      </fieldset>

      <fieldset disabled={!committeeEditable || busy || pairLocked} className="grid gap-3">
        <legend className="font-serif text-2xl text-gold-700">Delegation</legend>
        {allowsBoth ? (
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="SINGLE" {...form.register("delegation_type")} />
              Single del
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="DOUBLE" {...form.register("delegation_type")} />
              Double del
            </label>
          </div>
        ) : selectedCommittees.length ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" value={doubleOnly ? "DOUBLE" : "SINGLE"} {...form.register("delegation_type")} />
            {doubleOnly ? "Double del" : "Single del"}
          </label>
        ) : (
          <p className="text-sm text-ink-muted">Select committees first.</p>
        )}
        <p className="text-xs text-ink-muted">
          Fees differ by committee. The amount to pay is set after the secretariat allocates a
          committee.
        </p>
        {delegationType === "DOUBLE" || doubleOnly ? (
          <Field
            label="Partner email"
            htmlFor="partner_email"
            hint="They must already have an account. You share one portfolio; each of you gets a separate QR, attendance, and meals."
            error={form.formState.errors.partner_email?.message as string | undefined}
          >
            <Input id="partner_email" type="email" {...form.register("partner_email")} />
          </Field>
        ) : null}
      </fieldset>

      <fieldset disabled={!editable || busy}>
        <legend className="mb-3 font-serif text-2xl text-gold-700">Food preference</legend>
        <div className="flex flex-wrap gap-4">
          {(["VEG", "NON_VEG"] as const).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input type="radio" value={option} {...form.register("food_preference")} />
              {option === "VEG" ? "Vegetarian" : "Non-vegetarian"}
            </label>
          ))}
        </div>
        {form.formState.errors.food_preference ? (
          <p className="mt-2 text-xs text-red-800" role="alert">
            {String(form.formState.errors.food_preference.message ?? "")}
          </p>
        ) : null}
      </fieldset>

      <fieldset disabled={!editable || busy} className="grid gap-3">
        <legend className="font-serif text-2xl text-gold-700">Collective</legend>
        <Field
          label="Are you part of a collective?"
          htmlFor="collective_id"
          hint="Start typing to filter collectives. Leave blank if you are registering independently. Institution is optional if you pick one."
          error={form.formState.errors.collective_id?.message as string | undefined}
        >
          <Controller
            name="collective_id"
            control={form.control}
            render={({ field }) => (
              <CatalogIdSuggest
                id="collective_id"
                items={collectives}
                selectedId={String(field.value ?? "")}
                onSelectId={field.onChange}
                placeholder="Type a collective name"
              />
            )}
          />
        </Field>
      </fieldset>

      {grouped.map((group) => (
        <fieldset key={group.section} disabled={!editable || busy} className="grid gap-4">
          <legend className="font-serif text-2xl text-gold-700">{SECTION_LABELS[group.section]}</legend>
          {group.fields.map((field) => (
            <DynamicField
              key={field.id}
              field={field}
              control={form.control}
              register={form.register}
              institutions={institutions}
              optional={field.field_key === "institution" && Boolean(collectiveId)}
              error={
                (form.formState.errors[field.field_key]?.message as string | undefined) ??
                state.fieldErrors?.[field.field_key]
              }
            />
          ))}
        </fieldset>
      ))}

      {editable && isPreAllocationStatus(registration.status) ? (
        <div className="space-y-6">
          <div className="space-y-4 rounded-sm border border-gold-700/25 bg-parchment-100/70 p-5">
            <div>
              <p className="font-serif text-lg text-gold-800">Rules & Guidelines</p>
              <p className="mt-1 text-xs text-ink-muted">
                Please review the conference rulebook and guidelines before submitting. Both checkboxes must be agreed to before submitting registration.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={publishedDocs?.rulebook || "/rulebook"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-sm border border-gold-700/40 bg-parchment-50 px-4 text-xs font-medium text-gold-800 transition hover:bg-parchment-200"
              >
                View Rulebook ↗
              </a>
              <a
                href={publishedDocs?.guidelines || "/rulebook"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-sm border border-gold-700/40 bg-parchment-50 px-4 text-xs font-medium text-gold-800 transition hover:bg-parchment-200"
              >
                View Guidelines ↗
              </a>
            </div>
            <div className="space-y-2.5 border-t border-gold-700/15 pt-3">
              <label className="flex cursor-pointer select-none items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="read_rulebook"
                  checked={readRulebook}
                  onChange={(e) => setReadRulebook(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gold-700/30 text-gold-700 focus:ring-gold-600"
                />
                <span>I have read and agree to the Rulebook.</span>
              </label>
              <label className="flex cursor-pointer select-none items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="read_guidelines"
                  checked={readGuidelines}
                  onChange={(e) => setReadGuidelines(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gold-700/30 text-gold-700 focus:ring-gold-600"
                />
                <span>I have read and agree to the Conference Guidelines.</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={busy || !bothChecked}
              title={!bothChecked ? "Please agree to both the Rulebook and Guidelines to submit" : undefined}
            >
              {busy ? "Working…" : registration.status === "DRAFT" ? "Submit registration" : "Update submission"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => dispatch("draft", form.getValues())}
            >
              Save draft
            </Button>
          </div>
          <ActionFeedback error={state.error} success={state.success} />
        </div>
      ) : editable ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            Your committee has been allocated. Food preference and personal details can still be
            updated until payment is under review.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => dispatch("draft", form.getValues())}>
              {busy ? "Working…" : "Save details"}
            </Button>
          </div>
          <ActionFeedback error={state.error} success={state.success} />
        </div>
      ) : (
        <p className="text-sm text-ink-muted">
          {paymentLocked
            ? "Proof is under review or already verified. Committee changes now go through the secretariat."
            : allocated
              ? "This registration is locked. Committee and portfolio were allocated by the secretariat."
              : "This registration is locked."}
        </p>
      )}
    </form>
  );
}

function CatalogIdSuggest({
  id,
  items,
  selectedId,
  onSelectId,
  placeholder,
}: {
  id: string;
  items: { id: string; name: string }[];
  selectedId: string;
  onSelectId: (id: string) => void;
  placeholder?: string;
}) {
  const selected = items.find((item) => item.id === selectedId);
  const [draft, setDraft] = useState(selected?.name ?? "");
  const text = selected?.name ?? draft;
  return (
    <div>
    <NameSuggestInput
      id={id}
      items={items}
      value={text}
      placeholder={placeholder}
      onChange={(next, match) => {
        setDraft(next);
        onSelectId(match?.id ?? "");
      }}
    />
    {text.trim() && !selectedId ? (
      <p className="mt-1 text-xs text-ink-muted">
        No matching collective. Leave this blank if you are registering independently.
      </p>
    ) : null}
    </div>
  );
}

function DynamicField({
  field,
  control,
  register,
  error,
  optional = false,
  institutions = [],
}: {
  field: RegistrationFieldDefinition;
  control: Control<RegistrationFormValues>;
  register: UseFormRegister<RegistrationFormValues>;
  error?: string;
  optional?: boolean;
  institutions?: { id: string; name: string }[];
}) {
  const options = Array.isArray(field.options) ? field.options.map(String) : [];
  const hint =
    field.field_key === "institution"
      ? optional
        ? "Optional because you selected a collective. Type to search, or enter any name."
        : "Type to search suggested institutions. You can enter a name that is not on the list."
      : field.field_key === "mun_experience_details"
        ? `Format : ${MUN_EXPERIENCE_FORMAT}. Example : ${MUN_EXPERIENCE_EXAMPLE}`
      : isParticipantPhoneField(field.field_key)
        ? PHONE_HINT
        : field.required && !optional
          ? undefined
          : "Optional";

  if (field.field_key === "institution") {
    return (
      <Field label={field.label} htmlFor={field.field_key} error={error} hint={hint}>
        <Controller
          name={field.field_key}
          control={control}
          render={({ field: rhf }) => (
            <NameSuggestInput
              id={field.field_key}
              items={institutions}
              value={String(rhf.value ?? "")}
              maxLength={120}
              placeholder="Start typing your institution"
              onChange={(text) => rhf.onChange(text)}
            />
          )}
        />
      </Field>
    );
  }

  if (field.field_key === "mun_experience_details") {
    return (
      <Field label={field.label} htmlFor={field.field_key} error={error}>
        <div className="rounded-sm border border-gold-700/20 bg-parchment-100/80 px-3 py-2 text-xs leading-relaxed text-ink-muted">
          <p>Format : {MUN_EXPERIENCE_FORMAT}</p>
          <p>Example : {MUN_EXPERIENCE_EXAMPLE}</p>
        </div>
        <Textarea
          id={field.field_key}
          {...register(field.field_key)}
          placeholder={`${MUN_EXPERIENCE_FORMAT}\n${MUN_EXPERIENCE_EXAMPLE}`}
        />
      </Field>
    );
  }

  if (field.field_type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register(field.field_key)} />
        {field.label}
        {error ? (
          <span className="text-xs text-red-800" role="alert">
            {error}
          </span>
        ) : null}
      </label>
    );
  }

  if (field.field_type === "multiselect") {
    return (
      <Field label={field.label} htmlFor={field.field_key} error={error} hint={hint}>
        <Controller
          name={field.field_key}
          control={control}
          render={({ field: rhf }) => {
            const selected = Array.isArray(rhf.value) ? (rhf.value as string[]) : [];
            return (
              <div className="flex flex-col gap-2">
                {options.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(option)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...selected, option]
                          : selected.filter((item) => item !== option);
                        rhf.onChange(next);
                      }}
                    />
                    {option}
                  </label>
                ))}
              </div>
            );
          }}
        />
      </Field>
    );
  }

  if (field.field_type === "select") {
    return (
      <Field label={field.label} htmlFor={field.field_key} error={error} hint={hint}>
        <Select id={field.field_key} {...register(field.field_key)}>
          <option value="">Select</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  if (field.field_type === "number") {
    return (
      <Field label={field.label} htmlFor={field.field_key} error={error} hint={hint}>
        <Input id={field.field_key} type="number" {...register(field.field_key)} />
      </Field>
    );
  }

  if (field.field_type === "date") {
    return (
      <Field label={field.label} htmlFor={field.field_key} error={error} hint={hint}>
        <Input id={field.field_key} type="date" {...register(field.field_key)} />
      </Field>
    );
  }

  return (
    <Field label={field.label} htmlFor={field.field_key} error={error} hint={hint}>
      <Input
        id={field.field_key}
        {...register(field.field_key)}
        {...(isParticipantPhoneField(field.field_key) ? phoneInputProps : {})}
      />
    </Field>
  );
}
