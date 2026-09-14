"use client";

import { useActionState, useMemo, useState } from "react";
import { allocateRegistrationAction, type ParticipantAdminState } from "@/app/actions/participants";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/field";
import { formatInrFromMinor } from "@/lib/format";
import type { AdminParticipant, Committee } from "@/types";

export function AllocateRegistrationForm({
  participant,
  committees,
}: {
  participant: AdminParticipant;
  committees: Committee[];
}) {
  const action = allocateRegistrationAction.bind(null, participant.id);
  const [state, formAction, pending] = useActionState(action, {} as ParticipantAdminState);
  const prefs = participant.preferences ?? [];
  const preferredIds = prefs.map((pref) => pref.committee_id);
  const [committeeId, setCommitteeId] = useState(
    participant.committee_id ?? preferredIds[0] ?? committees[0]?.id ?? "",
  );

  const committee = committees.find((item) => item.id === committeeId);
  const pref = prefs.find((item) => item.committee_id === committeeId);
  const suggested = [pref?.portfolio_1, pref?.portfolio_2].filter(
    (name): name is string => Boolean(name && name.trim()),
  );
  const matrix = (committee?.portfolio_config ?? []).map((row) => row.name).filter(Boolean);
  const options = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of [...suggested, ...matrix]) {
      const key = name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  }, [suggested, matrix]);

  const defaultPortfolio = participant.allocated_portfolio || suggested[0] || "";
  const fee =
    committee &&
    formatInrFromMinor(
      participant.delegation_type === "DOUBLE"
        ? (committee.double_fee_minor ?? committee.fee_minor)
        : committee.fee_minor,
    );

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
    <form action={formAction} className="grid gap-4">
      {prefs.length ? (
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
      ) : (
        <p className="text-sm text-ink-muted">No committee preferences were saved on this form.</p>
      )}
      <Field label="Allot committee" htmlFor="committee_id">
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
      <Field label="Allot portfolio" htmlFor="portfolio" hint="Suggested from their preferences first, then the matrix.">
        {options.length ? (
          <Select id="portfolio" name="portfolio" defaultValue={defaultPortfolio} key={`${committeeId}-${defaultPortfolio}`}>
            <option value="">Select</option>
            {options.map((name) => (
              <option key={name} value={name}>
                {suggested.some((item) => item.toLowerCase() === name.toLowerCase()) ? `${name} (preferred)` : name}
              </option>
            ))}
          </Select>
        ) : (
          <input
            id="portfolio"
            name="portfolio"
            defaultValue={defaultPortfolio}
            className="w-full rounded-sm border border-gold-700/25 bg-parchment-50 px-3 py-2.5 text-sm"
            required
          />
        )}
      </Field>
      {fee ? (
        <p className="text-sm text-ink-muted">
          Fee for this allotment: {fee}
          {participant.delegation_type === "DOUBLE" ? " (double delegation)" : ""}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !committeeId}>
        {pending ? "Allocating…" : participant.committee_id ? "Update allocation" : "Allocate & unlock payment"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}
