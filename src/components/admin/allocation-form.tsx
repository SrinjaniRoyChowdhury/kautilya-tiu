"use client";

import { useActionState, useState } from "react";
import { allocateRegistrationAction, type ParticipantAdminState } from "@/app/actions/participants";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { formatInrFromMinor } from "@/lib/format";
import { outstationSummary } from "@/lib/outstation";
import type { AdminParticipant, Committee } from "@/types";

export function AllocateRegistrationForm({
  participant,
  committees,
  compact = false,
}: {
  participant: AdminParticipant;
  committees: Committee[];
  compact?: boolean;
}) {
  const action = allocateRegistrationAction.bind(null, participant.id);
  const [state, formAction, pending] = useActionState(action, {} as ParticipantAdminState);
  const prefs = participant.preferences ?? [];
  const preferredIds = prefs.map((pref) => pref.committee_id);
  const [committeeId, setCommitteeId] = useState(
    participant.committee_id ?? preferredIds[0] ?? committees[0]?.id ?? "",
  );

  const committee = committees.find((item) => item.id === committeeId);
  const isSpecialCrisis = Boolean(committee?.is_special_crisis);
  const isOutstation = Boolean(participant.is_outstation);
  const pref = prefs.find((item) => item.committee_id === committeeId);
  const suggested = [pref?.portfolio_1, pref?.portfolio_2].filter(
    (name): name is string => Boolean(name && name.trim()),
  );
  const defaultPortfolio = participant.allocated_portfolio || suggested[0] || "";
  const committeeFeeMinor =
    committee &&
    (participant.delegation_type === "DOUBLE"
      ? (committee.double_fee_minor ?? committee.fee_minor)
      : committee.fee_minor);
  const feeLabel =
    committeeFeeMinor != null
      ? formatInrFromMinor(committeeFeeMinor)
      : null;
  const defaultFeeRupees =
    participant.expected_fee_minor != null
      ? String(Math.round(participant.expected_fee_minor / 100))
      : "";
  const outstationLabel = outstationSummary(participant);

  if (participant.status === "DRAFT" || participant.status === "CANCELLED") {
    return <p className="text-sm text-ink-muted">They must submit the form before allocation.</p>;
  }
  if (participant.status === "CONFIRMED" || participant.status === "PAYMENT_VERIFIED") {
    return (
      <p className="text-sm text-ink-muted">
        Allocation is locked after payment verification or confirmation.
      </p>
    );
  }
  if (participant.paid) {
    return (
      <p className="text-sm text-ink-muted">
        Payment is under review or verified. Allocation cannot change now.
      </p>
    );
  }

  return (
    <form action={formAction} className={compact ? "grid gap-2.5" : "grid gap-4"}>
      {outstationLabel ? (
        <p className="rounded-sm border border-gold-700/20 bg-parchment-100/60 px-3 py-2 text-sm text-gold-800">
          {outstationLabel}
        </p>
      ) : null}
      {!compact && prefs.length ? (
        <div className="rounded-sm border border-gold-700/20 bg-parchment-100/60 p-3 text-sm">
          <p className="font-medium text-gold-800">Delegate preferences</p>
          <ol className="mt-2 grid gap-2">
            {prefs.map((item) => (
              <li key={`${item.committee_id}-${item.preference_order}`}>
                <span className="text-xs uppercase tracking-widest text-gold-700">
                  Preference {item.preference_order}
                </span>
                <p>
                  {item.committee_short_name ?? "Committee"}
                  {item.portfolio_1 ? ` · ${item.portfolio_1}` : ""}
                  {item.portfolio_2 ? ` / ${item.portfolio_2}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {!compact && !prefs.length ? (
        <p className="text-sm text-ink-muted">No committee preferences were saved on this form.</p>
      ) : null}
      <Field label="Committee" htmlFor="committee_id">
        <Select
          id="committee_id"
          name="committee_id"
          value={committeeId}
          onChange={(event) => setCommitteeId(event.target.value)}
        >
          <option value="">Select</option>
          {committees.map((item) => (
            <option key={item.id} value={item.id}>
              {item.short_name} · {item.name}
              {preferredIds.includes(item.id)
                ? ` · pref ${prefs.find((prefItem) => prefItem.committee_id === item.id)?.preference_order}`
                : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Portfolio"
        htmlFor="portfolio"
        hint={
          isSpecialCrisis
            ? "Optional for special crisis — leave blank to unlock payment now; assign later if needed."
            : compact
              ? suggested.length
                ? `Hint: ${suggested.join(" / ")}`
                : undefined
              : suggested.length
                ? `Type the country/portfolio. Pref hint: ${suggested.join(" / ")}`
                : "Type the country/portfolio name manually."
        }
      >
        <Input
          id="portfolio"
          name="portfolio"
          required={!isSpecialCrisis}
          defaultValue={defaultPortfolio}
          key={`${committeeId}-${defaultPortfolio}-${isSpecialCrisis ? "special" : "normal"}`}
          placeholder={isSpecialCrisis ? "Optional — secretariat can assign later" : "e.g. France"}
        />
      </Field>
      {isSpecialCrisis ? (
        <p className="text-xs text-ink-muted">
          Special crisis: allocating the committee alone unlocks payment.
        </p>
      ) : null}
      {isOutstation ? (
        <Field
          label="Fee (₹)"
          htmlFor="expected_fee_rupees"
          hint={
            feeLabel
              ? `Outstation fee is entered manually. Committee reference: ${feeLabel}${
                  participant.delegation_type === "DOUBLE" ? " (double)" : ""
                }.`
              : "Outstation fee is entered manually at allotment."
          }
        >
          <Input
            id="expected_fee_rupees"
            name="expected_fee_rupees"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={defaultFeeRupees}
            placeholder="e.g. 2500"
          />
        </Field>
      ) : feeLabel ? (
        <p className="text-xs text-ink-muted">
          Fee: {feeLabel}
          {participant.delegation_type === "DOUBLE" ? " (double)" : ""}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !committeeId} size={compact ? "sm" : undefined}>
        {pending ? "Allocating…" : participant.committee_id ? "Update allocation" : "Allocate & unlock payment"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}
