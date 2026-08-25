import type { AmountFlag, PaymentParticipant, PaymentStatus } from "@/types";

export const PAYMENT_STATUS_COPY: Record<
  PaymentStatus,
  { label: string; detail: string }
> = {
  DRAFT: {
    label: "Draft",
    detail: "Add who this payment covers, then upload the UPI screenshot.",
  },
  PENDING: {
    label: "Awaiting proof",
    detail: "Pay the expected amount to the UPI / bank details and upload a screenshot.",
  },
  UNDER_REVIEW: {
    label: "Under review",
    detail: "The secretariat has your screenshot. You will be notified after verification.",
  },
  VERIFIED: {
    label: "Verified",
    detail: "This payment is verified. Linked registrations are confirmed.",
  },
  REJECTED: {
    label: "Rejected",
    detail: "Upload a new screenshot. The previous rejection reason stays on this record.",
  },
  CANCELLED: {
    label: "Cancelled",
    detail: "This payment is cancelled.",
  },
};

export const AMOUNT_FLAG_COPY: Record<AmountFlag, string> = {
  UNDERPAID: "Underpaid",
  EXACT: "Exact",
  OVERPAID: "Overpaid",
  UNKNOWN: "Amount unknown",
};

export function parseEmailList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const email = part.trim().toLowerCase();
    if (!email) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function participantEmail(row: PaymentParticipant): string {
  if (row.unmatched_email) return String(row.unmatched_email);
  const nested = row.users;
  const user = Array.isArray(nested) ? nested[0] : nested;
  if (user?.email) return user.email;
  const regUser = row.registrations?.users;
  const fromReg = Array.isArray(regUser) ? regUser[0] : regUser;
  return fromReg?.email ?? "Unknown";
}

export function participantName(row: PaymentParticipant): string {
  const nested = row.users;
  const user = Array.isArray(nested) ? nested[0] : nested;
  if (user?.full_name) return user.full_name;
  const regUser = row.registrations?.users;
  const fromReg = Array.isArray(regUser) ? regUser[0] : regUser;
  return fromReg?.full_name ?? participantEmail(row);
}

export function participantResolution(row: PaymentParticipant): string {
  if (row.registration_id) return "Linked registration";
  if (row.user_id) return "Account found — they must submit a registration before this amount is known";
  return "Unmatched email — replace with a registered delegate";
}

export function paymentEditable(status: PaymentStatus): boolean {
  return status === "DRAFT" || status === "PENDING" || status === "REJECTED";
}

export function coveringPaymentLocksRegistration(status: PaymentStatus | null | undefined): boolean {
  return status === "UNDER_REVIEW" || status === "VERIFIED";
}

export function classifyAmountFlag(
  expectedMinor: number,
  paidMinor: number | null | undefined,
): AmountFlag {
  if (paidMinor == null || !Number.isFinite(paidMinor)) return "UNKNOWN";
  if (paidMinor < expectedMinor) return "UNDERPAID";
  if (paidMinor > expectedMinor) return "OVERPAID";
  return "EXACT";
}
