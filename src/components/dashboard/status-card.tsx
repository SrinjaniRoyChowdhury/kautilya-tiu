import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatDelegation, formatInrFromMinor } from "@/lib/format";
import { isPayableRegistration } from "@/lib/registration";
import type { Committee, Registration } from "@/types";

const STATUS_COPY: Record<string, { label: string; detail: string }> = {
  DRAFT: {
    label: "Draft",
    detail: "Your form is saved. Submit it so the secretariat can allocate a committee.",
  },
  SUBMITTED: {
    label: "Awaiting allocation",
    detail: "Registration is in. Payment stays locked until the secretariat allots your committee and portfolio.",
  },
  PAYMENT_PENDING: {
    label: "Payment pending",
    detail: "Committee allocated. Upload UPI proof from Payment. The amount is based on the allotted committee.",
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

const PIPELINE = [
  { key: "register", label: "Register" },
  { key: "allocation", label: "Allocation" },
  { key: "payment", label: "Payment" },
  { key: "confirmation", label: "Confirmation" },
  { key: "credentials", label: "Credentials" },
] as const;

function pipelineIndex(status: string): number {
  if (status === "DRAFT") return 0;
  if (status === "SUBMITTED") return 1;
  if (status === "PAYMENT_PENDING" || status === "PAYMENT_REJECTED") return 2;
  if (status === "PAYMENT_VERIFIED") return 3;
  if (status === "CONFIRMED") return 4;
  return 0;
}

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
        <ol className="mt-4 flex flex-wrap gap-2 text-xs">
          {PIPELINE.map((step) => (
            <li key={step.key} className="rounded-sm border border-gold-700/20 px-2 py-1 text-ink-muted">
              {step.label}
            </li>
          ))}
        </ol>
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
  const active = pipelineIndex(registration.status);
  return (
    <Card>
      <p className="text-xs uppercase tracking-widest text-gold-700">Registration</p>
      <p className="mt-2 font-serif text-2xl">{copy.label}</p>
      <p className="mt-2 text-sm text-ink-muted">{copy.detail}</p>
      <ol className="mt-4 flex flex-wrap gap-2">
        {PIPELINE.map((step, index) => {
          const done = index < active || (registration.status === "CONFIRMED" && index <= active);
          const current = index === active;
          return (
            <li
              key={step.key}
              className={`rounded-sm px-2 py-1 text-xs ${
                current
                  ? "bg-gold-700 text-parchment-50"
                  : done
                    ? "border border-gold-700/40 text-gold-800"
                    : "border border-gold-700/20 text-ink-muted"
              }`}
            >
              {index + 1}. {step.label}
            </li>
          );
        })}
      </ol>
      {committee ? (
        <p className="mt-3 text-sm">
          {committee.short_name} · {committee.name}
          {registration.expected_fee_minor != null ? (
            <> · {formatInrFromMinor(registration.expected_fee_minor)} due</>
          ) : null}
        </p>
      ) : registration.status === "SUBMITTED" ? (
        <p className="mt-3 text-sm text-ink-muted">Committee will appear here after allocation.</p>
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
        {isPayableRegistration(registration.status) ? (
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
