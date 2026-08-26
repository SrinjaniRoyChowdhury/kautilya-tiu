"use client";

import { useActionState } from "react";
import { activatePhaseAction, type PhaseState } from "@/app/actions/phases";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { PHASE_LABELS } from "@/lib/phases";
import type { RegistrationPhase } from "@/types";

export function PhaseActivateList({ phases }: { phases: RegistrationPhase[] }) {
  if (!phases.length) {
    return <p className="text-sm text-ink-muted">Phases will appear after this edition is saved.</p>;
  }
  return (
    <ul className="grid gap-2">
      {phases.map((phase) => (
        <li
          key={phase.id}
          className="flex flex-wrap items-center justify-between gap-2 border-b border-gold-700/10 py-2 last:border-b-0"
        >
          <div>
            <p className="font-medium">{PHASE_LABELS[phase.kind]}</p>
            <p className="text-xs text-ink-muted">
              {phase.is_active ? "Currently used for new registrations and fees." : "Inactive"}
            </p>
          </div>
          {phase.is_active ? (
            <span className="rounded-sm bg-gold-700 px-2 py-1 text-xs text-parchment-50">Active</span>
          ) : (
            <ActivateButton phaseId={phase.id} />
          )}
        </li>
      ))}
    </ul>
  );
}

function ActivateButton({ phaseId }: { phaseId: string }) {
  async function run(_prev: PhaseState, _formData: FormData): Promise<PhaseState> {
    void _prev;
    void _formData;
    return activatePhaseAction(phaseId);
  }
  const [state, formAction, pending] = useActionState(run, {} as PhaseState);
  return (
    <form action={formAction}>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Switching…" : "Make active"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} className="text-xs" />
    </form>
  );
}
