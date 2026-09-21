"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createParticipantRegistrationAction,
  loadAddParticipantMetaAction,
  type CreateParticipantState,
} from "@/app/actions/participants";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, ModalTrigger } from "@/components/ui/modal";
import { NameSuggestInput } from "@/components/ui/name-suggest";
import { PHONE_HINT, isParticipantPhoneField, phoneInputProps } from "@/lib/phone";
import { MUN_EXPERIENCE_EXAMPLE, MUN_EXPERIENCE_FORMAT } from "@/lib/constants";
import type {
  Committee,
  Edition,
  Institution,
  RegistrationFieldDefinition,
} from "@/types";

type Meta = {
  fields: RegistrationFieldDefinition[];
  committees: Committee[];
  collectives: { id: string; name: string }[];
  institutions: Institution[];
};

export function AddParticipantModalButton({
  editions,
  defaultEditionId,
  canEdit,
}: {
  editions: Edition[];
  defaultEditionId?: string | null;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!canEdit || !editions.length) return null;
  return (
    <>
      <ModalTrigger label="Add participant" onOpen={() => setOpen(true)} />
      <Modal open={open} title="Add participant" onClose={() => setOpen(false)} wide>
        <AddParticipantForm
          editions={editions}
          defaultEditionId={defaultEditionId ?? editions[0]?.id}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function AddParticipantForm({
  editions,
  defaultEditionId,
  onDone,
}: {
  editions: Edition[];
  defaultEditionId?: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [editionId, setEditionId] = useState(defaultEditionId ?? editions[0]?.id ?? "");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [loadingMeta, startMetaLoad] = useTransition();
  const [prefs, setPrefs] = useState<{ committee_id: string; portfolio_1: string; portfolio_2: string }[]>([
    { committee_id: "", portfolio_1: "", portfolio_2: "" },
    { committee_id: "", portfolio_1: "", portfolio_2: "" },
  ]);
  const [delegationType, setDelegationType] = useState<"SINGLE" | "DOUBLE">("SINGLE");
  const [collectiveId, setCollectiveId] = useState("");
  const [collectiveDraft, setCollectiveDraft] = useState("");
  const [state, action, pending] = useActionState(
    createParticipantRegistrationAction,
    {} as CreateParticipantState,
  );

  useEffect(() => {
    if (!editionId) return;
    startMetaLoad(async () => {
      setMetaError(null);
      const result = await loadAddParticipantMetaAction(editionId);
      if (result.error) {
        setMeta(null);
        setMetaError(result.error);
        return;
      }
      setMeta({
        fields: result.fields ?? [],
        committees: result.committees ?? [],
        collectives: result.collectives ?? [],
        institutions: result.institutions ?? [],
      });
      setPrefs([
        { committee_id: "", portfolio_1: "", portfolio_2: "" },
        { committee_id: "", portfolio_1: "", portfolio_2: "" },
      ]);
      setCollectiveId("");
      setCollectiveDraft("");
    });
  }, [editionId]);

  useEffect(() => {
    if (state.registrationId) {
      onDone();
      router.push(`/admin/participants/${state.registrationId}`);
    }
  }, [state.registrationId, onDone, router]);

  const specialCrisisIds = useMemo(
    () => new Set((meta?.committees ?? []).filter((c) => c.is_special_crisis).map((c) => c.id)),
    [meta?.committees],
  );

  const selectedCommittees = prefs
    .map((pref) => meta?.committees.find((c) => c.id === pref.committee_id))
    .filter((c): c is Committee => Boolean(c));
  const allowsBoth =
    selectedCommittees.some((c) => c.allows_single_del) &&
    selectedCommittees.some((c) => c.allows_double_del);
  const doubleOnly =
    selectedCommittees.length > 0 &&
    selectedCommittees.every((c) => c.allows_double_del && !c.allows_single_del);

  function updatePref(index: number, patch: Partial<(typeof prefs)[number]>) {
    setPrefs((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="edition_id" value={editionId} />
      <input
        type="hidden"
        name="special_crisis_ids"
        value={[...specialCrisisIds].filter((id) => prefs.some((p) => p.committee_id === id)).join(",")}
      />
      <input type="hidden" name="preference_count" value={String(prefs.length)} />
      {prefs.map((pref, index) => (
        <div key={`hidden-pref-${index}`}>
          <input type="hidden" name={`preference_${index}_committee_id`} value={pref.committee_id} />
          <input type="hidden" name={`preference_${index}_portfolio_1`} value={pref.portfolio_1} />
          <input type="hidden" name={`preference_${index}_portfolio_2`} value={pref.portfolio_2} />
        </div>
      ))}
      <input type="hidden" name="collective_id" value={collectiveId} />
      <input type="hidden" name="delegation_type" value={doubleOnly ? "DOUBLE" : delegationType} />

      <p className="text-sm text-ink-muted">
        The person must already have a signed-up account with a verified email. This creates a submitted
        registration linked to that account; allocate a committee afterward.
      </p>

      {editions.length > 1 ? (
        <Field label="Edition" htmlFor="add_edition">
          <Select
            id="add_edition"
            value={editionId}
            onChange={(event) => setEditionId(event.target.value)}
          >
            {editions.map((edition) => (
              <option key={edition.id} value={edition.id}>
                {edition.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field
        label="Signed-up email"
        htmlFor="email"
        hint="Must match an existing verified participant account."
        error={state.fieldErrors?.email}
      >
        <Input id="email" name="email" type="email" required autoComplete="off" />
      </Field>

      {metaError ? <p className="text-sm text-red-800">{metaError}</p> : null}
      {loadingMeta && !meta ? <p className="text-sm text-ink-muted">Loading edition fields…</p> : null}

      {meta ? (
        <>
          <fieldset className="grid gap-3">
            <legend className="font-serif text-lg text-gold-700">Committee preferences</legend>
            <p className="text-xs text-ink-muted">Select 2 or 3 committees in preference order.</p>
            {prefs.map((pref, index) => {
              const committee = meta.committees.find((c) => c.id === pref.committee_id);
              const isSpecial = Boolean(committee?.is_special_crisis);
              const used = new Set(prefs.map((p, i) => (i === index ? "" : p.committee_id)).filter(Boolean));
              return (
                <div key={index} className="grid gap-2 rounded-sm border border-gold-700/20 p-3">
                  <Field label={`Preference ${index + 1}`} htmlFor={`pref_committee_${index}`}>
                    <Select
                      id={`pref_committee_${index}`}
                      value={pref.committee_id}
                      onChange={(event) =>
                        updatePref(index, {
                          committee_id: event.target.value,
                          portfolio_1: "",
                          portfolio_2: "",
                        })
                      }
                    >
                      <option value="">Select committee</option>
                      {meta.committees.map((item) => (
                        <option key={item.id} value={item.id} disabled={used.has(item.id)}>
                          {item.short_name} · {item.name}
                          {item.is_special_crisis ? " (special crisis)" : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {pref.committee_id && !isSpecial ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Portfolio 1" htmlFor={`pref_p1_${index}`}>
                        <Input
                          id={`pref_p1_${index}`}
                          value={pref.portfolio_1}
                          onChange={(event) => updatePref(index, { portfolio_1: event.target.value })}
                          required
                        />
                      </Field>
                      <Field label="Portfolio 2 (optional)" htmlFor={`pref_p2_${index}`}>
                        <Input
                          id={`pref_p2_${index}`}
                          value={pref.portfolio_2}
                          onChange={(event) => updatePref(index, { portfolio_2: event.target.value })}
                        />
                      </Field>
                    </div>
                  ) : null}
                  {isSpecial ? (
                    <p className="text-xs text-ink-muted">
                      Special crisis — portfolio is assigned by the secretariat later.
                    </p>
                  ) : null}
                </div>
              );
            })}
            {prefs.length < 3 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setPrefs((current) => [...current, { committee_id: "", portfolio_1: "", portfolio_2: "" }])
                }
              >
                Add 3rd preference
              </Button>
            ) : null}
            {prefs.length > 2 ? (
              <Button type="button" variant="ghost" onClick={() => setPrefs((current) => current.slice(0, 2))}>
                Remove 3rd preference
              </Button>
            ) : null}
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="font-serif text-lg text-gold-700">Delegation</legend>
            {allowsBoth ? (
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={delegationType === "SINGLE"}
                    onChange={() => setDelegationType("SINGLE")}
                  />
                  Single del
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={delegationType === "DOUBLE"}
                    onChange={() => setDelegationType("DOUBLE")}
                  />
                  Double del
                </label>
              </div>
            ) : selectedCommittees.length ? (
              <p className="text-sm text-ink-muted">{doubleOnly ? "Double del" : "Single del"}</p>
            ) : (
              <p className="text-sm text-ink-muted">Select committees first.</p>
            )}
            {delegationType === "DOUBLE" || doubleOnly ? (
              <Field
                label="Partner email"
                htmlFor="partner_email"
                hint="Partner must already have a signed-up account."
                error={state.fieldErrors?.partner_email}
              >
                <Input id="partner_email" name="partner_email" type="email" />
              </Field>
            ) : (
              <input type="hidden" name="partner_email" value="" />
            )}
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="font-serif text-lg text-gold-700">Food preference</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {(["VEG", "NON_VEG"] as const).map((option) => (
                <label key={option} className="flex items-center gap-2">
                  <input type="radio" name="food_preference" value={option} required />
                  {option === "VEG" ? "Vegetarian" : "Non-vegetarian"}
                </label>
              ))}
            </div>
            {state.fieldErrors?.food_preference ? (
              <p className="text-xs text-red-800">{state.fieldErrors.food_preference}</p>
            ) : null}
          </fieldset>

          <Field
            label="Collective (optional)"
            htmlFor="collective_suggest"
            hint="Leave blank if registering independently."
          >
            <NameSuggestInput
              id="collective_suggest"
              items={meta.collectives}
              value={meta.collectives.find((item) => item.id === collectiveId)?.name ?? collectiveDraft}
              placeholder="Type a collective name"
              onChange={(next, match) => {
                setCollectiveDraft(next);
                setCollectiveId(match?.id ?? "");
              }}
            />
          </Field>

          <fieldset className="grid gap-3">
            <legend className="font-serif text-lg text-gold-700">Registration details</legend>
            {meta.fields.map((field) => (
              <AdminDynamicField
                key={field.id}
                field={field}
                institutions={meta.institutions}
                optional={field.field_key === "institution" && Boolean(collectiveId)}
                error={state.fieldErrors?.[field.field_key]}
              />
            ))}
          </fieldset>
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || loadingMeta || !meta}>
          {pending ? "Creating…" : "Create registration"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}

function AdminDynamicField({
  field,
  institutions,
  optional,
  error,
}: {
  field: RegistrationFieldDefinition;
  institutions: Institution[];
  optional?: boolean;
  error?: string;
}) {
  const options = Array.isArray(field.options) ? field.options.map(String) : [];
  const hint =
    field.field_key === "institution"
      ? optional
        ? "Optional because a collective is selected."
        : "Type to search, or enter any name."
      : field.field_key === "mun_experience_details"
        ? `Format: ${MUN_EXPERIENCE_FORMAT}`
        : isParticipantPhoneField(field.field_key)
          ? PHONE_HINT
          : field.required && !optional
            ? undefined
            : "Optional";

  if (field.field_key === "institution") {
    return (
      <Field label={field.label} htmlFor={field.field_key} error={error} hint={hint}>
        <InstitutionField fieldKey={field.field_key} institutions={institutions} />
      </Field>
    );
  }

  if (field.field_key === "mun_experience_details") {
    return (
      <Field label={field.label} htmlFor={field.field_key} error={error} hint={hint}>
        <Textarea
          id={field.field_key}
          name={field.field_key}
          placeholder={`${MUN_EXPERIENCE_FORMAT}\n${MUN_EXPERIENCE_EXAMPLE}`}
        />
      </Field>
    );
  }

  if (field.field_type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name={field.field_key} />
        {field.label}
      </label>
    );
  }

  if (field.field_type === "select") {
    return (
      <Field label={field.label} htmlFor={field.field_key} error={error} hint={hint}>
        <Select id={field.field_key} name={field.field_key} required={field.required && !optional}>
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
        <Input
          id={field.field_key}
          name={field.field_key}
          type="number"
          required={field.required && !optional}
        />
      </Field>
    );
  }

  return (
    <Field label={field.label} htmlFor={field.field_key} error={error} hint={hint}>
      <Input
        id={field.field_key}
        name={field.field_key}
        required={field.required && !optional}
        {...(isParticipantPhoneField(field.field_key) ? phoneInputProps : {})}
      />
    </Field>
  );
}

function InstitutionField({
  fieldKey,
  institutions,
}: {
  fieldKey: string;
  institutions: Institution[];
}) {
  const [value, setValue] = useState("");
  return (
    <>
      <input type="hidden" name={fieldKey} value={value} />
      <NameSuggestInput
        id={fieldKey}
        items={institutions}
        value={value}
        maxLength={120}
        placeholder="Start typing institution"
        onChange={(text) => setValue(text)}
      />
    </>
  );
}
