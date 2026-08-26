import type { Metadata } from "next";
import Link from "next/link";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getDashboardKpis } from "@/lib/analytics";
import { hasPermission } from "@/lib/auth";
import { getAllEditionsAdmin, getEditionExpenseTotal } from "@/lib/data";
import { formatInrFromMinor } from "@/lib/format";

export const metadata: Metadata = { title: "Admin" };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PAYMENT_PENDING: "Awaiting pay",
  PAYMENT_VERIFIED: "Pay verified",
  PAYMENT_REJECTED: "Pay rejected",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  PENDING: "Pending",
  UNDER_REVIEW: "Under review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const { edition: editionId } = await searchParams;
  const editions = await getAllEditionsAdmin();
  const edition =
    editions.find((item) => item.id === editionId) ??
    editions.find((item) => item.is_public_active) ??
    editions[0] ??
    null;
  const extraActive = editions.filter((item) => item.is_public_active).length > 1;

  const [canReg, canPay, canAtt, canFood] = await Promise.all([
    hasPermission("registration.view", edition?.id),
    hasPermission("payment.view", edition?.id),
    hasPermission("attendance.scan", edition?.id),
    hasPermission("food.scan", edition?.id),
  ]);

  const kpis = edition
    ? await getDashboardKpis(edition.id, {
        registration: canReg,
        payment: canPay,
        attendance: canAtt,
        food: canFood,
      })
    : null;
  const expensesTotal = edition && canPay ? await getEditionExpenseTotal(edition.id) : 0;
  const revenue = kpis?.payment?.paidVerifiedMinor ?? 0;

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Staff"
        title="Admin portal"
        description="Edition-scoped registration, payment, attendance, and food counts. Cards only appear for permissions you hold."
      />
      {extraActive ? (
        <p className="mb-6 rounded-sm bg-parchment-200 px-3 py-2 text-sm" role="status">
          More than one edition is flagged public-active. The public site will still work; pick one
          flag so the CTA is unambiguous (FR-EDIT-003).
        </p>
      ) : null}
      {editions.length > 1 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {editions.map((item) => (
            <Link
              key={item.id}
              href={`/admin?edition=${item.id}`}
              className={
                item.id === edition?.id
                  ? "rounded-sm bg-gold-700 px-3 py-1.5 text-sm text-parchment-50"
                  : "rounded-sm border border-gold-700/25 px-3 py-1.5 text-sm text-gold-700"
              }
            >
              {item.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis?.registration ? (
          <Card>
            <p className="text-xs uppercase tracking-widest text-gold-700">Registrations</p>
            <p className="mt-2 font-serif text-4xl text-gold-700">{kpis.registration.total}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {kpis.registration.confirmed} confirmed · {kpis.registration.veg} veg ·{" "}
              {kpis.registration.nonVeg} non-veg
            </p>
            <ul className="mt-3 space-y-1 text-xs text-ink-muted">
              {Object.entries(kpis.registration.byStatus).map(([status, count]) => (
                <li key={status}>
                  {STATUS_LABEL[status] ?? status}: {count}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        {kpis?.payment ? (
          <Card>
            <p className="text-xs uppercase tracking-widest text-gold-700">Payments</p>
            <p className="mt-2 font-serif text-4xl text-gold-700">{kpis.payment.underReview}</p>
            <p className="mt-1 text-sm text-ink-muted">In the review queue</p>
            <p className="mt-3 text-sm">
              Expected {formatInrFromMinor(kpis.payment.expectedMinor)}
            </p>
            <p className="text-sm text-ink-muted">
              Verified {formatInrFromMinor(kpis.payment.paidVerifiedMinor)}
            </p>
            <ul className="mt-3 space-y-1 text-xs text-ink-muted">
              {Object.entries(kpis.payment.byStatus).map(([status, count]) => (
                <li key={status}>
                  {STATUS_LABEL[status] ?? status}: {count}
                </li>
              ))}
            </ul>
            <Link href="/admin/payments" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
              Open queue
            </Link>
          </Card>
        ) : null}
        {kpis?.payment ? (
          <Card>
            <p className="text-xs uppercase tracking-widest text-gold-700">Accounts</p>
            <p className="mt-2 font-serif text-3xl text-gold-700">{formatInrFromMinor(revenue - expensesTotal)}</p>
            <p className="mt-1 text-sm text-ink-muted">Balance (verified revenue − expenses)</p>
            <p className="mt-3 text-sm">Revenue {formatInrFromMinor(revenue)}</p>
            <p className="text-sm text-ink-muted">Expenses {formatInrFromMinor(expensesTotal)}</p>
            <Link href="/admin/expenses" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
              Open expenses
            </Link>
          </Card>
        ) : null}
        {kpis?.attendance ? (
          <Card>
            <p className="text-xs uppercase tracking-widest text-gold-700">Attendance</p>
            <p className="mt-2 font-serif text-4xl text-gold-700">
              {kpis.attendance.byDay[1] + kpis.attendance.byDay[2] + kpis.attendance.byDay[3]}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Check-ins vs {kpis.registration?.confirmed ?? "—"} confirmed
            </p>
            <ul className="mt-3 space-y-1 text-xs text-ink-muted">
              {[1, 2, 3].map((day) => (
                <li key={day}>
                  Day {day}: {kpis.attendance?.byDay[day] ?? 0}
                </li>
              ))}
            </ul>
            <Link href="/admin/attendance" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
              Open desk log
            </Link>
          </Card>
        ) : null}
        {kpis?.food ? (
          <Card>
            <p className="text-xs uppercase tracking-widest text-gold-700">Food collected</p>
            <p className="mt-2 font-serif text-4xl text-gold-700">
              {kpis.food.reduce((sum, meal) => sum + meal.collected, 0)}
            </p>
            <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-xs text-ink-muted">
              {kpis.food.map((meal) => (
                <li key={meal.meal_schedule_id}>
                  Day {meal.event_day} {meal.meal_name}: {meal.collected}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      {kpis?.committees?.length ? (
        <Card className="mt-6">
          <p className="font-serif text-2xl text-gold-700">Committee fill</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {kpis.committees.map((committee) => {
              const pct =
                committee.capacity > 0
                  ? Math.min(100, Math.round((committee.occupied / committee.capacity) * 100))
                  : 0;
              return (
                <li key={committee.id}>
                  <div className="flex justify-between text-sm">
                    <span>{committee.short_name}</span>
                    <span className="text-ink-muted">
                      {committee.occupied} / {committee.capacity} delegations
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 bg-parchment-200">
                    <div className="h-1.5 bg-gold-700" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-widest text-gold-700">Editions</p>
          <p className="mt-2 font-serif text-4xl text-gold-700">{editions.length}</p>
          <Link href="/admin/editions" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
            Manage
          </Link>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gold-700">Credentials</p>
          <p className="mt-2 text-sm text-ink-muted">
            Regenerate a lost or leaked QR. The previous token fails immediately.
          </p>
          <Link href="/admin/credentials" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
            Open list
          </Link>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gold-700">CMS</p>
          <p className="mt-2 text-sm text-ink-muted">Homepage, about, announcements, gallery.</p>
          <Link href="/admin/cms" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
            Edit content
          </Link>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gold-700">Reports</p>
          <p className="mt-2 text-sm text-ink-muted">CSV exports for participants, payments, attendance, food.</p>
          <Link href="/admin/reports" className="mt-3 inline-block text-sm text-gold-700 hover:underline">
            Download
          </Link>
        </Card>
      </div>
    </Container>
  );
}
