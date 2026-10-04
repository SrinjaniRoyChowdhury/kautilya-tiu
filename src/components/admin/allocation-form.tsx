"use client";

import { useActionState, useState } from "react";
import {
  allocateRegistrationAction,
  reallocatePortfolioAfterPaymentAction,
  type ParticipantAdminState,
} from "@/app/actions/participants";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatInrFromMinor } from "@/lib/format";
import { outstationSummary, suggestedOutstationFeeMinor } from "@/lib/outstation";
import { PHASE_LABELS } from "@/lib/phases";
import type { AdminParticipant, Committee } from "@/types";

function isPaymentComplete(participant: AdminParticipant): boolean {
  return (
    participant.status === "CONFIRMED" ||
    participant.status === "PAYMENT_VERIFIED"
  );
}

export function AllocateRegistrationForm({
  participant,
  committees,
  submittedPhaseFees = {},
  canOverrideFee = false,
  canUnlockAfterPayment = false,
  compact = false,
}: {
  participant: AdminParticipant;
  committees: Committee[];
  /** Fees for the phase locked at submission (Early Bird etc.). */
  submittedPhaseFees?: Record<string, { single_fee_minor: number; double_fee_minor: number }>;
  /** Super Admin may enter a previous-phase / custom fee. */
  canOverrideFee?: boolean;
  /** Delegate Affairs / Super Admin may change portfolio after payment. */
  canUnlockAfterPayment?: boolean;
  compact?: boolean;
}) {
  if (participant.status === "DRAFT" || participant.status === "CANCELLED") {
    return <p className="text-sm text-ink-muted">They must submit the form before allocation.</p>;
  }

  if (isPaymentComplete(participant)) {
    if (!canUnlockAfterPayment) {
      return (
        <p className="text-sm text-ink-muted">
          Allocation is locked after payment. Delegate Affairs or a Super Admin can change the
          portfolio (committee stays fixed) with a reason.
        </p>
      );
    }
    if (!participant.committee_id) {
      return (
        <p className="text-sm text-ink-muted">
          No committee on this registration — cannot unlock portfolio after payment.
        </p>
      );
    }
    return (
      <ReallocatePortfolioForm
        participant={participant}
        committees={committees}
        compact={compact}
      />
    );
  }

  // Payment under review: still locked for everyone.
  if (participant.paid) {
    return (
      <p className="text-sm text-ink-muted">
        Payment is under review. Portfolio can be changed after verification by Delegate Affairs or a
        Super Admin.
      </p>
    );
  }

  return (
    <PrePaymentAllocateForm
      participant={participant}
      committees={committees}
      submittedPhaseFees={submittedPhaseFees}
      canOverrideFee={canOverrideFee}
      compact={compact}
    />
  );
}

function ReallocatePortfolioForm({
  participant,
  committees,
  compact,
}: {
  participant: AdminParticipant;
  committees: Committee[];
  compact?: boolean;
}) {
  const action = reallocatePortfolioAfterPaymentAction.bind(null, participant.id);
  const [state, formAction, pending] = useActionState(action, {} as ParticipantAdminState);
  const committee = committees.find((item) => item.id === participant.committee_id);
  const isSpecialCrisis = Boolean(committee?.is_special_crisis);
  const prefs = participant.preferences ?? [];
  const pref = prefs.find((item) => item.committee_id === participant.committee_id);
  const suggested = [pref?.portfolio_1, pref?.portfolio_2].filter(
    (name): name is string => Boolean(name && name.trim()),
  );
  const defaultPortfolio = participant.allocated_portfolio || suggested[0] || "";
  const committeeLabel = committee
    ? `${committee.short_name} · ${committee.name}`
    : participant.committee_short_name ?? "Allotted committee";

  return (
    <form action={formAction} className={compact ? "grid gap-2.5" : "grid gap-4"}>
      <p className="rounded-sm border border-gold-700/20 bg-parchment-100/60 px-3 py-2 text-sm text-gold-800">
        Payment complete. You can change <span className="font-medium">portfolio only</span> —
        committee cannot be changed. A reason is required and stored in the audit log.
      </p>
      <div>
        <p className="text-xs uppercase tracking-widest text-gold-700">Committee (locked)</p>
        <p className="mt-1 text-sm font-medium">{committeeLabel}</p>
      </div>
      <Field
        label="Portfolio"
        htmlFor="portfolio"
        hint={
          isSpecialCrisis
            ? "Optional for special crisis."
            : suggested.length
              ? `Pref hint: ${suggested.join(" / ")}`
              : undefined
        }
      >
        <Input
          id="portfolio"
          name="portfolio"
          required={!isSpecialCrisis}
          defaultValue={defaultPortfolio}
          placeholder={isSpecialCrisis ? "Optional" : "e.g. France"}
        />
      </Field>
      <Field label="Reason" htmlFor="reason" hint="At least 3 characters — recorded in audit.">
        <Textarea
          id="reason"
          name="reason"
          required
          minLength={3}
          rows={3}
          placeholder="e.g. Portfolio conflict resolved with EB; reassigned country"
        />
      </Field>
      <Button type="submit" disabled={pending} size={compact ? "sm" : undefined}>
        {pending ? "Updating…" : "Update portfolio"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}

function PrePaymentAllocateForm({
  participant,
  committees,
  submittedPhaseFees = {},
  canOverrideFee = false,
  compact = false,
}: {
  participant: AdminParticipant;
  committees: Committee[];
  submittedPhaseFees?: Record<string, { single_fee_minor: number; double_fee_minor: number }>;
  canOverrideFee?: boolean;
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
  const phaseFee = committeeId ? submittedPhaseFees[committeeId] : undefined;
  const committeeFeeMinor =
    committee &&
    (participant.delegation_type === "DOUBLE"
      ? (phaseFee?.double_fee_minor ?? committee.double_fee_minor ?? committee.fee_minor)
      : (phaseFee?.single_fee_minor ?? committee.fee_minor));
  const feeLabel =
    committeeFeeMinor != null
      ? formatInrFromMinor(committeeFeeMinor)
      : null;
  const submittedPhaseLabel = participant.submitted_phase_kind
    ? PHASE_LABELS[participant.submitted_phase_kind]
    : null;
  const suggestedOutstationMinor = isOutstation ? suggestedOutstationFeeMinor(participant) : null;
  const defaultFeeRupees =
    participant.expected_fee_minor != null
      ? String(Math.round(participant.expected_fee_minor / 100))
      : suggestedOutstationMinor != null
        ? String(Math.round(suggestedOutstationMinor / 100))
        : "";
  const outstationLabel = outstationSummary(participant);
  const suggestedFeeLabel =
    suggestedOutstationMinor != null ? formatInrFromMinor(suggestedOutstationMinor) : null;

  return (
    <form action={formAction} className={compact ? "grid gap-2.5" : "grid gap-4"}>
      {outstationLabel ? (
        <p className="rounded-sm border border-gold-700/20 bg-parchment-100/60 px-3 py-2 text-sm text-gold-800">
          {outstationLabel}
        </p>
      ) : null}
      {submittedPhaseLabel ? (
        <p className="rounded-sm border border-gold-700/20 bg-parchment-100/60 px-3 py-2 text-sm text-gold-800">
          Submitted under <span className="font-medium">{submittedPhaseLabel}</span>. First allotment
          uses that phase’s fee. If the active phase changes after allotment, unpaid delegates move to
          the new phase fee unless a Super Admin locks a previous amount.
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
            [
              suggestedFeeLabel ? `Suggested from outstation options: ${suggestedFeeLabel}.` : null,
              "Editable — enter the final fee before unlocking payment (must be greater than zero; use Confirm free for complimentary).",
              feeLabel
                ? `Committee reference: ${feeLabel}${
                    participant.delegation_type === "DOUBLE" ? " (double)" : ""
                  }.`
                : null,
            ]
              .filter(Boolean)
              .join(" ")
          }
        >
          <Input
            id="expected_fee_rupees"
            name="expected_fee_rupees"
            type="number"
            min={1}
            step={1}
            required
            defaultValue={defaultFeeRupees}
            placeholder="e.g. 2500"
          />
        </Field>
      ) : canOverrideFee ? (
        <Field
          label="Fee override (₹, Super Admin)"
          htmlFor="expected_fee_rupees"
          hint={
            [
              feeLabel
                ? `Default allotment fee: ${feeLabel}${
                    submittedPhaseLabel ? ` (${submittedPhaseLabel})` : ""
                  }.`
                : null,
              "Leave blank for automatic pricing. Enter a previous-phase amount only when locking an older fee after a phase change.",
            ]
              .filter(Boolean)
              .join(" ")
          }
        >
          <Input
            id="expected_fee_rupees"
            name="expected_fee_rupees"
            type="number"
            min={1}
            step={1}
            defaultValue=""
            placeholder={feeLabel ? `e.g. ${Math.round((committeeFeeMinor ?? 0) / 100)}` : "Previous phase ₹"}
          />
        </Field>
      ) : feeLabel ? (
        <p className="text-xs text-ink-muted">
          Fee: {feeLabel}
          {participant.delegation_type === "DOUBLE" ? " (double)" : ""}
          {submittedPhaseLabel ? ` · ${submittedPhaseLabel}` : ""}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !committeeId} size={compact ? "sm" : undefined}>
        {pending ? "Allocating…" : participant.committee_id ? "Update allocation" : "Allocate & unlock payment"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}
