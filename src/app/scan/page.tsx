import type { Metadata } from "next";
import { ScanDesk } from "@/components/scan/scan-desk";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import { eventDayFromEdition, getActiveEdition, getMealSchedules } from "@/lib/data";

export const metadata: Metadata = { title: "Scan" };

export default async function ScanPage() {
  const edition = await getActiveEdition();
  const [canAttendance, canFood, meals] = await Promise.all([
    hasPermission("attendance.scan", edition?.id),
    hasPermission("food.scan", edition?.id),
    edition ? getMealSchedules(edition.id) : Promise.resolve([]),
  ]);

  return (
    <Container className="py-6 sm:py-12">
      <PageHeader
        eyebrow="Venue"
        title="Scanner"
        description="Pick the day (and meal) first. Use the laptop webcam against a phone showing the enlarged QR. Participants cannot open this desk."
      />
      {canAttendance || canFood ? (
        <ScanDesk
          canAttendance={canAttendance}
          canFood={canFood}
          meals={meals}
          defaultDay={eventDayFromEdition(edition?.start_date)}
        />
      ) : (
        <Card>
          <p className="text-ink-muted">
            This login can open the scanner, but it has no attendance or food permission on the
            public-active edition.
          </p>
        </Card>
      )}
    </Container>
  );
}
