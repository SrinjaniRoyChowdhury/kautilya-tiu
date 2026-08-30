import { formatInrFromMinor } from "@/lib/format";
import type { Committee } from "@/types";

export function CommitteePrizeBlock({
  committee,
  size = "sm",
}: {
  committee: Pick<Committee, "prize_money_json" | "show_prize_money">;
  size?: "sm" | "lg";
}) {
  if (!committee.show_prize_money || !committee.prize_money_json?.length) return null;

  if (size === "lg") {
    return (
      <div className="space-y-2 border-t border-gold-700/15 pt-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">Prize money</p>
        <ul className="space-y-1.5">
          {committee.prize_money_json.map((prize) => (
            <li key={prize.category} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink-muted">{prize.category}</span>
              <span className="font-medium text-gold-700">{formatInrFromMinor(prize.amount_minor)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-2 border-t border-gold-700/15 pt-2 text-right">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-700/80">
        Prize money
      </p>
      <ul className="space-y-0.5">
        {committee.prize_money_json.map((prize) => (
          <li key={prize.category} className="text-xs text-ink-muted">
            {prize.category}{" "}
            <span className="font-medium text-gold-700">{formatInrFromMinor(prize.amount_minor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
