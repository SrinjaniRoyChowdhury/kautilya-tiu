import { formatInrFromMinor } from "@/lib/format";
import { PHASE_LABELS } from "@/lib/phases";
import type { Committee, RegistrationPhaseKind } from "@/types";

export function CommitteeFeeBlock({
  committee,
  size = "sm",
}: {
  committee: Pick<
    Committee,
    "fee_minor" | "double_fee_minor" | "allows_single_del" | "allows_double_del" | "current_phase_kind"
  >;
  size?: "sm" | "lg";
}) {
  const phaseLabel = committee.current_phase_kind
    ? PHASE_LABELS[committee.current_phase_kind as RegistrationPhaseKind]
    : null;
  const singleOnly = committee.allows_single_del && !committee.allows_double_del;
  const doubleOnly = committee.allows_double_del && !committee.allows_single_del;
  const both = committee.allows_single_del && committee.allows_double_del;
  const singleFee = formatInrFromMinor(committee.fee_minor);
  const doubleFee = formatInrFromMinor(committee.double_fee_minor ?? committee.fee_minor);

  if (size === "lg") {
    return (
      <div className="space-y-3">
        {phaseLabel ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">{phaseLabel}</p>
        ) : null}
        {singleOnly || both ? (
          <div>
            <p className="text-xs text-ink-muted">Single delegation</p>
            <p className="font-serif text-3xl text-gold-700">{singleFee}</p>
          </div>
        ) : null}
        {doubleOnly || both ? (
          <div>
            <p className="text-xs text-ink-muted">Double delegation</p>
            <p className={both ? "font-serif text-2xl text-gold-700" : "font-serif text-3xl text-gold-700"}>
              {doubleFee}
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="text-right">
      {phaseLabel ? (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-700/80">
          {phaseLabel}
        </p>
      ) : null}
      {singleOnly || both ? (
        <p className="text-sm font-medium text-ink">
          Single <span className="text-gold-700">{singleFee}</span>
        </p>
      ) : null}
      {doubleOnly || both ? (
        <p className={singleOnly || both ? "mt-0.5 text-xs text-ink-muted" : "text-sm font-medium text-ink"}>
          Double <span className="text-gold-700">{doubleFee}</span>
        </p>
      ) : null}
    </div>
  );
}
