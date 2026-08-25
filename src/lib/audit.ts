import { isUuid } from "@/lib/ids";
import type { AuditLog } from "@/types";

function paymentIdFromUnknown(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const raw = rec.payment_id;
  if (typeof raw === "string" && isUuid(raw)) return raw;
  return null;
}

export function paymentHrefFromAudit(row: AuditLog): string | null {
  if (row.entity === "payments" && row.entity_id && isUuid(row.entity_id)) {
    return `/admin/payments/${row.entity_id}`;
  }
  if (!row.action.startsWith("payment.")) return null;
  const nested = paymentIdFromUnknown(row.new_value) ?? paymentIdFromUnknown(row.old_value);
  if (nested) return `/admin/payments/${nested}`;
  return null;
}
