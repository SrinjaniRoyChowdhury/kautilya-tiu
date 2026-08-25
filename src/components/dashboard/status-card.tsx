import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatDelegation, formatInrFromMinor } from "@/lib/format";
import type { Committee, Registration } from "@/types";

const STATUS_COPY: Record<string, { label: string; detail: string }> = {
  DRAFT: {
    label: "Draft",
    detail: "Your form is saved. Submit it to hold a committee place and proceed to payment.",
  },
  SUBMITTED: {
    label: "Submitted",
    detail: "Registration is in. Complete payment when the payment desk opens.",
  },
  PAYMENT_PENDING: {
    label: "Payment pending",
    detail: "Delegation held. Upload UPI proof from Payment. You may still change committee until proof is under review.",
  },
  PAYMENT_VERIFIED: {
    label: "Payment verified",
    detail: "The secretariat has verified payment. Confirmation follows this status.",
  },
  PAYMENT_REJECTED: {
    label: "Payment rejected",
    detail: "The last payment was rejected. Update the form if needed and resubmit proof.",
  },
  CONFIRMED: {
    label: "Confirmed",
    detail: "You are confirmed. Open Credential for the scannable QR used all three days and for meals.",
  },
  CANCELLED: {
    label: "Cancelled",
    detail: "This registration is cancelled.",
  },
};

export function RegistrationStatusCard({
  registration,
  committee,
}: {
  registration: Registration | null;
  committee: Committee | null;
}) {
  if (!registration) {
    return (
      <Card>
        <p className="text-xs uppercase tracking-widest text-gold-700">Registration</p>
        <p className="mt-2 font-serif text-2xl">Not started</p>
        <p className="mt-2 text-sm text-ink-muted">
          Every participant registers individually, even if someone else will pay.
        </p>
        <Link
          href="/dashboard/register"
          className="mt-4 inline-flex h-11 items-center rounded-sm bg-gold-700 px-4 text-sm font-medium text-parchment-50"
        >
          Start registration
        </Link>
      </Card>
    );
  }

  const copy = STATUS_COPY[registration.status] ?? STATUS_COPY.DRAFT;
  return (
    <Card>
      <p className="text-xs uppercase tracking-widest text-gold-700">Registration</p>
      <p className="mt-2 font-serif text-2xl">{copy.label}</p>
      <p className="mt-2 text-sm text-ink-muted">{copy.detail}</p>
      {committee ? (
        <p className="mt-3 text-sm">
          {committee.short_name} · {committee.name}
          {registration.expected_fee_minor != null ? (
            <> · {formatInrFromMinor(registration.expected_fee_minor)} snapshotted</>
          ) : null}
        </p>
      ) : null}
      {formatDelegation(registration.allocated_slr, registration.allocated_portfolio) ? (
        <p className="mt-1 text-sm">
          Allocated delegation: {formatDelegation(registration.allocated_slr, registration.allocated_portfolio)}
        </p>
      ) : null}
      {registration.food_preference ? (
        <p className="mt-1 text-sm text-ink-muted">Food: {registration.food_preference}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/dashboard/register" className="text-sm text-gold-700 hover:underline">
          {registration.status === "DRAFT" ? "Continue form" : "View registration"}
        </Link>
        {registration.status === "PAYMENT_PENDING" || registration.status === "PAYMENT_REJECTED" ? (
          <Link href="/dashboard/pay" className="text-sm text-gold-700 hover:underline">
            Go to payment
          </Link>
        ) : null}
        {registration.status === "CONFIRMED" ? (
          <Link href="/dashboard/qr" className="text-sm text-gold-700 hover:underline">
            Open credential
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
