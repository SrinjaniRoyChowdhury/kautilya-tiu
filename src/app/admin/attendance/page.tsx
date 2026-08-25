import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { ManualAttendanceForm } from "@/components/admin/manual-attendance-form";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import {
  eventDayFromEdition,
  getActiveEdition,
  getAllEditionsAdmin,
  getAttendanceRoll,
  getFoodCollections,
  getFoodStats,
} from "@/lib/data";
import { formatScanTime } from "@/lib/qr-http";

export const metadata: Metadata = { title: "Venue" };

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; edition?: string }>;
}) {
  const { day, edition: editionId } = await searchParams;
  const editions = await getAllEditionsAdmin();
  const edition =
    editions.find((item) => item.id === editionId) ??
    (await getActiveEdition()) ??
    editions[0] ??
    null;
  const defaultDay = eventDayFromEdition(edition?.start_date);
  const eventDay = day ? Number(day) : defaultDay;
  const [canView, canCorrect, roll, food, collections] = await Promise.all([
    hasPermission("attendance.scan", edition?.id),
    hasPermission("attendance.correct", edition?.id),
    edition ? getAttendanceRoll(edition.id, eventDay) : Promise.resolve([]),
    edition && (await hasPermission("food.scan", edition.id))
      ? getFoodStats(edition.id)
      : Promise.resolve([]),
    edition && (await hasPermission("food.scan", edition.id))
      ? getFoodCollections(edition.id, eventDay)
      : Promise.resolve([]),
  ]);

  if (!canView && food.length === 0) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Venue"
          description="You need attendance.scan or food.scan to open this desk log."
        />
      </Container>
    );
  }

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Staff"
        title="Venue"
        description="Check-ins for the selected day, meal collection counts, and manual corrections."
      />
      <AdminNav current="/admin/attendance" />
      <div className="mb-6 flex flex-wrap gap-2">
        {[1, 2, 3].map((item) => (
          <Link
            key={item}
            href={`/admin/attendance?day=${item}${edition ? `&edition=${edition.id}` : ""}`}
            className={
              item === eventDay
                ? "rounded-sm bg-gold-700 px-3 py-1.5 text-sm text-parchment-50"
                : "rounded-sm border border-gold-700/25 px-3 py-1.5 text-sm text-gold-700"
            }
          >
            Day {item}
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {canView ? (
          <Card>
            <p className="font-serif text-2xl text-gold-700">
              Day {eventDay} · {roll.length} in
            </p>
            {roll.length ? (
              <ul className="mt-4 grid gap-2 text-sm">
                {roll.map((row) => (
                  <li key={row.id}>
                    <span className="font-medium">{row.full_name}</span>
                    {row.committee_short_name ? ` · ${row.committee_short_name}` : ""} ·{" "}
                    {formatScanTime(row.checked_in_at)}
                    {row.checked_out_at ? ` → ${formatScanTime(row.checked_out_at)}` : ""}
                    {row.method === "MANUAL" ? " · manual" : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ink-muted">No check-ins for this day yet.</p>
            )}
          </Card>
        ) : null}
        {food.length ? (
          <Card>
            <p className="font-serif text-2xl text-gold-700">Meals collected</p>
            <ul className="mt-4 grid gap-2 text-sm">
              {food
                .filter((row) => row.event_day === eventDay)
                .map((row) => (
                  <li key={row.meal_schedule_id}>
                    {row.meal_name}: {row.collected}
                  </li>
                ))}
            </ul>
          </Card>
        ) : null}
        {collections.length || food.length ? (
          <Card className="lg:col-span-2">
            <p className="font-serif text-2xl text-gold-700">Who collected food</p>
            <p className="mt-1 text-sm text-ink-muted">Lunch and evening snacks for day {eventDay}.</p>
            {collections.length ? (
              <ul className="mt-4 grid gap-2 text-sm">
                {collections.map((row) => (
                  <li key={row.id}>
                    <span className="font-medium">{row.full_name}</span>
                    {row.committee_short_name ? ` · ${row.committee_short_name}` : ""} · {row.meal_name} ·{" "}
                    {formatScanTime(row.collected_at)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ink-muted">Nobody has collected a meal on this day yet.</p>
            )}
          </Card>
        ) : null}
        {canCorrect ? (
          <Card>
            <p className="mb-4 font-serif text-2xl text-gold-700">Manual correction</p>
            <ManualAttendanceForm />
          </Card>
        ) : null}
      </div>
    </Container>
  );
}
