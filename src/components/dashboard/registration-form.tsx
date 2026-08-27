"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm, useWatch, type Control, type Resolver, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { NameSuggestInput } from "@/components/ui/name-suggest";
import { registrationFormAction, type RegistrationState } from "@/app/actions/registrations";
import {
  buildRegistrationSchema,
  PRE_PAYMENT_STATUSES,
  SECTION_LABELS,
  seatsHeld,
  type RegistrationFormValues,
} from "@/lib/registration";
import { formatInrFromMinor, seatsRemaining } from "@/lib/format";
import { PHASE_LABELS } from "@/lib/phases";
import type {
  Committee,
  FieldSection,
  Registration,
  RegistrationFieldDefinition,
  RegistrationFieldValue,
} from "@/types";

const SECTION_ORDER: FieldSection[] = ["PERSONAL", "MUN_INFO", "FOOD", "ADDITIONAL"];

function defaultValues(
  fields: RegistrationFieldDefinition[],
  values: RegistrationFieldValue[],
  registration: Registration,
  preferredCommitteeId?: string,
): RegistrationFormValues {
  const byDef = new Map(values.map((row) => [row.field_definition_id, row]));
  const out: RegistrationFormValues = {
    committee_id: registration.committee_id ?? preferredCommitteeId ?? "",
    food_preference: registration.food_preference ?? ("" as RegistrationFormValues["food_preference"]),
    collective_id: registration.collective_id ?? "",
    delegation_type: registration.delegation_type ?? "SINGLE",
    partner_email: registration.partner_email ?? "",
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
  fd.set("committee_id", String(values.committee_id ?? ""));
  fd.set("food_preference", String(values.food_preference ?? ""));
  fd.set("collective_id", String(values.collective_id ?? ""));
  fd.set("delegation_type", String(values.delegation_type ?? "SINGLE"));
  fd.set("partner_email", String(values.partner_email ?? ""));
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
  preferredCommitteeId,
  paymentLocked = false,
}: {
  editionId: string;
  registration: Registration;
  fields: RegistrationFieldDefinition[];
  committees: Committee[];
  values: RegistrationFieldValue[];
  collectives: { id: string; name: string }[];
  institutions: { id: string; name: string }[];
  preferredCommitteeId?: string;
  paymentLocked?: boolean;
}) {
  const editable =
    (PRE_PAYMENT_STATUSES as readonly string[]).includes(registration.status) && !paymentLocked;
  const schema = useMemo(() => buildRegistrationSchema(fields), [fields]);
  const [state, formAction, actionPending] = useActionState(
    registrationFormAction,
    {} as RegistrationState,
  );
  const [pending, startTransition] = useTransition();
  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<RegistrationFormValues>,
    defaultValues: defaultValues(fields, values, registration, preferredCommitteeId),
  });

  const busy = pending || actionPending;
  const holdsSeat =
    registration.committee_id &&
    registration.status !== "DRAFT" &&
    registration.status !== "CANCELLED";

  function dispatch(intent: "draft" | "submit", data: RegistrationFormValues) {
    const committee = committees.find((item) => item.id === data.committee_id);
    if (committee?.allows_double_del && !committee.allows_single_del) data.delegation_type = "DOUBLE";
    if (committee && !committee.allows_double_del) data.delegation_type = "SINGLE";
    const fd = new FormData();
    fd.set("intent", intent);
    fd.set("registration_id", registration.id);
    fd.set("edition_id", editionId);
    appendValues(fd, data, fields);
    startTransition(() => formAction(fd));
  }

  const grouped = SECTION_ORDER.map((section) => ({
    section,
    fields: fields.filter((field) => field.section === section),
  })).filter((group) => group.fields.length > 0);
  const collectiveId = String(useWatch({ control: form.control, name: "collective_id" }) ?? "");
  const selectedCommitteeId = String(useWatch({ control: form.control, name: "committee_id" }) ?? "");
  const delegationType = String(useWatch({ control: form.control, name: "delegation_type" }) ?? "SINGLE");
  const selectedCommittee = committees.find((item) => item.id === selectedCommitteeId);
  const pairLocked = registration.is_pair_lead === false;

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

      <fieldset disabled={!editable || busy || pairLocked} className="grid gap-3">
        <legend className="mb-2 font-serif text-2xl text-gold-700">Committee</legend>
        {committees.map((committee) => {
          const taken = seatsHeld(committee.occupied_count, committee.confirmed_count);
          const holdingThis = holdsSeat && registration.committee_id === committee.id;
          const remaining = seatsRemaining(committee.capacity, holdingThis ? Math.max(taken - 1, 0) : taken);
          const full = remaining <= 0 && committee.status === "OPEN" && !holdingThis;
          const closed = committee.status !== "OPEN";
          const phaseLabel = committee.current_phase_kind
            ? PHASE_LABELS[committee.current_phase_kind]
            : null;
          return (
            <label
              key={committee.id}
              className="frame-gold flex cursor-pointer items-start gap-3 rounded-sm bg-parchment-50/90 p-4 has-[:checked]:bg-parchment-200"
            >
              <input
                type="radio"
                value={committee.id}
                disabled={full || closed || pairLocked}
                className="mt-1"
                {...form.register("committee_id")}
              />
              <span className="flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-serif text-xl">
                    {committee.short_name} · {committee.name}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {formatInrFromMinor(committee.fee_minor)}
                    {committee.allows_double_del
                      ? ` · double ${formatInrFromMinor(committee.double_fee_minor ?? committee.fee_minor)}`
                      : ""}
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
            </label>
          );
        })}
        {form.formState.errors.committee_id ? (
          <p className="text-xs text-red-800" role="alert">
            {String(form.formState.errors.committee_id.message ?? state.fieldErrors?.committee_id ?? "")}
          </p>
        ) : null}
      </fieldset>

      <fieldset disabled={!editable || busy || pairLocked} className="grid gap-3">
        <legend className="font-serif text-2xl text-gold-700">Delegation</legend>
        {selectedCommittee?.allows_single_del && selectedCommittee.allows_double_del ? (
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="SINGLE" {...form.register("delegation_type")} />
              Single del · {formatInrFromMinor(selectedCommittee.fee_minor)}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="DOUBLE" {...form.register("delegation_type")} />
              Double del · {formatInrFromMinor(selectedCommittee.double_fee_minor ?? selectedCommittee.fee_minor)}
            </label>
          </div>
        ) : selectedCommittee ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              value={selectedCommittee.allows_double_del && !selectedCommittee.allows_single_del ? "DOUBLE" : "SINGLE"}
              {...form.register("delegation_type")}
            />
            {selectedCommittee.allows_double_del && !selectedCommittee.allows_single_del
              ? `Double del · ${formatInrFromMinor(selectedCommittee.double_fee_minor ?? selectedCommittee.fee_minor)}`
              : `Single del · ${formatInrFromMinor(selectedCommittee.fee_minor)}`}
          </label>
        ) : (
          <p className="text-sm text-ink-muted">Select a committee first.</p>
        )}
        {delegationType === "DOUBLE" ||
        (selectedCommittee?.allows_double_del && !selectedCommittee.allows_single_del) ? (
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

      {editable ? (
        <div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy}>
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
      ) : (
        <p className="text-sm text-ink-muted">
          {paymentLocked
            ? "Proof is under review or already verified. Committee changes now go through the secretariat."
            : "This registration is locked. Committee changes after payment require the secretariat."}
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
  const [text, setText] = useState(selected?.name ?? "");
  useEffect(() => {
    if (selectedId) {
      const name = items.find((item) => item.id === selectedId)?.name;
      if (name) setText(name);
    }
  }, [items, selectedId]);
  return (
    <div>
    <NameSuggestInput
      id={id}
      items={items}
      value={text}
      placeholder={placeholder}
      onChange={(next, match) => {
        setText(next);
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
      {field.field_key === "dietary_notes" ? (
        <Textarea id={field.field_key} {...register(field.field_key)} />
      ) : (
        <Input id={field.field_key} {...register(field.field_key)} />
      )}
    </Field>
  );
}
