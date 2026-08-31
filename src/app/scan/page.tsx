import type { Metadata } from "next";
import { ScanDesk } from "@/components/scan/scan-desk";
import { Card } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { eventDayFromEdition, getActiveEdition, getMealSchedules } from "@/lib/data";

export const metadata: Metadata = { title: "Scan Desk" };

export default async function ScanPage() {
  const edition = await getActiveEdition();
  const [canAttendance, canFood, meals] = await Promise.all([
    hasPermission("attendance.scan", edition?.id),
    hasPermission("food.scan", edition?.id),
    edition ? getMealSchedules(edition.id) : Promise.resolve([]),
  ]);

  return (
    <main className="w-full bg-parchment-100/50 px-2 py-2 sm:px-4 sm:py-4">
      <div className="mx-auto max-w-5xl">
        {canAttendance || canFood ? (
          <ScanDesk
            canAttendance={canAttendance}
            canFood={canFood}
            meals={meals}
            defaultDay={eventDayFromEdition(edition?.start_date)}
          />
        ) : (
          <Card className="p-6 text-center">
            <p className="text-ink-muted">
              This login has no attendance or food scanning permission on the active edition.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}

