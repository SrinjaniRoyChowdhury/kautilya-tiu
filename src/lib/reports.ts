import { hasPermission } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { getAdminPayments, getAttendanceRoll, getMealSchedules } from "@/lib/data";
import { participantEmail } from "@/lib/payments";
import { normalizePortfolios } from "@/lib/sheet";
import { createClient } from "@/lib/supabase/server";

export const REPORT_KINDS = ["participants", "payments", "attendance", "food"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

function rupees(minor: number | null | undefined): string {
  return String(Math.round((minor ?? 0) / 100));
}

function iso(value: string | null | undefined): string {
  return value ?? "";
}

export async function canExportKind(
  kind: ReportKind,
  editionId?: string | null,
): Promise<boolean> {
  if (await hasPermission("report.export", editionId)) return true;
  if (kind === "participants" || kind === "attendance") {
    return hasPermission("report.participants", editionId);
  }
  if (kind === "payments") return hasPermission("report.payments", editionId);
  if (kind === "food") return hasPermission("report.food", editionId);
  return false;
}

export async function canDownloadCommitteeAllocations(editionId?: string | null): Promise<boolean> {
  if (await hasPermission("committee.manage", editionId)) return true;
  return canExportKind("participants", editionId);
}

async function participantRows(editionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("registrations")
    .select(
      `status, food_preference, expected_fee_minor, submitted_at, confirmed_at,
       users:user_id (full_name, email, phone),
       committees:committee_id (short_name, name)`,
    )
    .eq("edition_id", editionId)
    .is("deleted_at", null)
    .order("submitted_at", { ascending: true });
  type Row = {
    status: string;
    food_preference: string | null;
    expected_fee_minor: number | null;
    submitted_at: string | null;
    confirmed_at: string | null;
    users: { full_name: string; email: string; phone: string | null } | { full_name: string; email: string; phone: string | null }[] | null;
    committees: { short_name: string; name: string } | { short_name: string; name: string }[] | null;
  };
  const headers = [
    "full_name",
    "email",
    "phone",
    "committee",
    "status",
    "food_preference",
    "expected_fee_inr",
    "submitted_at",
    "confirmed_at",
  ];
  const rows = ((data as Row[] | null) ?? []).map((row) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const committee = Array.isArray(row.committees) ? row.committees[0] : row.committees;
    return [
      user?.full_name ?? "",
      user?.email ?? "",
      user?.phone ?? "",
      committee?.short_name ?? "",
      row.status,
      row.food_preference ?? "",
      rupees(row.expected_fee_minor),
      iso(row.submitted_at),
      iso(row.confirmed_at),
    ];
  });
  return { headers, rows };
}

async function paymentRows(editionId: string) {
  const payments = await getAdminPayments(editionId);
  const headers = [
    "payment_id",
    "status",
    "amount_flag",
    "expected_inr",
    "paid_inr",
    "payer_email",
    "participants",
    "transaction_ref",
    "paid_at",
    "verified_at",
    "rejection_reason",
  ];
  const rows = payments.map((payment) => {
    const payer = Array.isArray(payment.payer) ? payment.payer[0] : payment.payer;
    return [
      payment.id,
      payment.status,
      payment.amount_flag,
      rupees(payment.expected_amount_minor),
      rupees(payment.paid_amount_minor),
      payer?.email ?? "",
      payment.payment_participants.map(participantEmail).join("; "),
      payment.transaction_ref ?? "",
      iso(payment.paid_at),
      iso(payment.verified_at),
      payment.rejection_reason ?? "",
    ];
  });
  return { headers, rows };
}

async function attendanceRows(editionId: string) {
  const roll = await getAttendanceRoll(editionId);
  const headers = [
    "full_name",
    "email",
    "committee",
    "event_day",
    "checked_in_at",
    "checked_out_at",
    "method",
    "notes",
  ];
  const rows = roll.map((row) => [
    row.full_name ?? "",
    row.email ?? "",
    row.committee_short_name ?? "",
    row.event_day,
    iso(row.checked_in_at),
    iso(row.checked_out_at),
    row.method,
    row.notes ?? "",
  ]);
  return { headers, rows };
}

async function foodRows(editionId: string) {
  const supabase = await createClient();
  const schedules = await getMealSchedules(editionId);
  const names = new Map(schedules.map((meal) => [meal.id, meal]));
  const { data } = await supabase
    .from("food_distribution")
    .select(
      `collected_at, meal_schedule_id,
       registrations:registration_id!inner (
         edition_id,
         users:user_id (full_name, email),
         committees:committee_id (short_name)
       )`,
    )
    .eq("registrations.edition_id", editionId)
    .order("collected_at", { ascending: true });
  type Row = {
    collected_at: string;
    meal_schedule_id: string;
    registrations:
      | {
          users: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
          committees: { short_name: string } | { short_name: string }[] | null;
        }
      | {
          users: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
          committees: { short_name: string } | { short_name: string }[] | null;
        }[]
      | null;
  };
  const headers = ["full_name", "email", "committee", "event_day", "meal_name", "collected_at"];
  const rows = ((data as Row[] | null) ?? []).map((row) => {
    const registration = Array.isArray(row.registrations) ? row.registrations[0] : row.registrations;
    const user = Array.isArray(registration?.users) ? registration?.users[0] : registration?.users;
    const committee = Array.isArray(registration?.committees)
      ? registration?.committees[0]
      : registration?.committees;
    const meal = names.get(row.meal_schedule_id);
    return [
      user?.full_name ?? "",
      user?.email ?? "",
      committee?.short_name ?? "",
      meal?.event_day ?? "",
      meal?.name ?? "",
      iso(row.collected_at),
    ];
  });
  return { headers, rows };
}

export async function committeeAllocationRows(committeeId: string) {
  const supabase = await createClient();
  const { data: committee } = await supabase
    .from("committees")
    .select("id, short_name, name, edition_id, portfolio_config")
    .eq("id", committeeId)
    .maybeSingle();
  if (!committee) return null;
  const { data } = await supabase
    .from("registrations")
    .select("allocated_slr, allocated_portfolio, users:user_id (full_name, email)")
    .eq("committee_id", committeeId)
    .is("deleted_at", null)
    .neq("status", "CANCELLED");
  type Row = {
    allocated_slr: number | null;
    allocated_portfolio: string | null;
    users: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
  };
  const bySlr = new Map<number, { name: string; email: string }>();
  for (const row of (data as Row[] | null) ?? []) {
    if (!row.allocated_slr) continue;
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    bySlr.set(row.allocated_slr, { name: user?.full_name ?? "", email: user?.email ?? "" });
  }
  const portfolios = normalizePortfolios(committee.portfolio_config);
  const headers = ["SLR No.", "Portfolio", "Delegate name", "Delegate email"];
  const rows = portfolios.map((item) => {
    const assigned = bySlr.get(item.slr);
    return [item.slr, item.name, assigned?.name ?? "", assigned?.email ?? ""];
  });
  return {
    editionId: committee.edition_id as string,
    shortName: String(committee.short_name ?? "committee"),
    headers,
    rows,
  };
}

export async function csvForReport(
  kind: ReportKind,
  editionId: string,
  slug: string,
): Promise<Response> {
  const builders = {
    participants: participantRows,
    payments: paymentRows,
    attendance: attendanceRows,
    food: foodRows,
  };
  const { headers, rows } = await builders[kind](editionId);
  return csvResponse(`kautilya-${kind}-${slug}.csv`, headers, rows);
}
