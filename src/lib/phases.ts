import type { RegistrationPhaseKind } from "@/types";

export const PHASE_KINDS: RegistrationPhaseKind[] = ["EARLY_BIRD", "PHASE_1", "PHASE_2"];

export const PHASE_LABELS: Record<RegistrationPhaseKind, string> = {
  EARLY_BIRD: "Early Bird",
  PHASE_1: "Phase 1",
  PHASE_2: "Phase 2",
};

export function rupeesFromForm(value: FormDataEntryValue | number | string | null, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 100);
}
