import { createClient } from "@/lib/supabase/server";
import { getCommitteesForEdition, getFoodStats } from "@/lib/data";
import type { PaymentStatus, RegistrationStatus } from "@/types";

export type RegistrationKpis = {
  total: number;
  byStatus: Record<string, number>;
  confirmed: number;
  freeConfirmed: number;
  veg: number;
  nonVeg: number;
};

export type PaymentKpis = {
  byStatus: Record<string, number>;
  expectedMinor: number;
  paidVerifiedMinor: number;
  underReview: number;
};

export type AttendanceKpis = {
  byDay: Record<number, number>;
};

export type DashboardKpis = {
  registration: RegistrationKpis | null;
  payment: PaymentKpis | null;
  attendance: AttendanceKpis | null;
  food: Awaited<ReturnType<typeof getFoodStats>> | null;
  committees: Array<{
    id: string;
    short_name: string;
    name: string;
    capacity: number;
    occupied: number;
  }> | null;
};

const EMPTY_REG: Record<string, number> = {};

export async function getDashboardKpis(
  editionId: string,
  access: {
    registration: boolean;
    payment: boolean;
    attendance: boolean;
    food: boolean;
  },
): Promise<DashboardKpis> {
  const supabase = await createClient();
  const result: DashboardKpis = {
    registration: null,
    payment: null,
    attendance: null,
    food: null,
    committees: null,
  };

  if (access.registration) {
    const [{ data: regs }, committees] = await Promise.all([
      supabase
        .from("registrations")
        .select("status, food_preference, confirmed_free")
        .eq("edition_id", editionId)
        .is("deleted_at", null),
      getCommitteesForEdition(editionId),
    ]);
    const byStatus: Record<string, number> = { ...EMPTY_REG };
    let veg = 0;
    let nonVeg = 0;
    let freeConfirmed = 0;
    for (const row of (regs as {
      status: RegistrationStatus;
      food_preference: string | null;
      confirmed_free: boolean;
    }[] | null) ?? []) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      if (row.food_preference === "VEG") veg += 1;
      if (row.food_preference === "NON_VEG") nonVeg += 1;
      if (row.confirmed_free) freeConfirmed += 1;
    }
    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
    result.registration = {
      total,
      byStatus,
      confirmed: byStatus.CONFIRMED ?? 0,
      freeConfirmed,
      veg,
      nonVeg,
    };
    result.committees = committees.map((committee) => ({
      id: committee.id,
      short_name: committee.short_name,
      name: committee.name,
      capacity: committee.capacity,
      occupied: committee.occupied_count ?? committee.confirmed_count,
    }));
  }

  if (access.payment) {
    const { data } = await supabase
      .from("payments")
      .select("status, expected_amount_minor, paid_amount_minor")
      .eq("edition_id", editionId)
      .is("deleted_at", null);
    const byStatus: Record<string, number> = {};
    let expectedMinor = 0;
    let paidVerifiedMinor = 0;
    let underReview = 0;
    for (const row of (data as {
      status: PaymentStatus;
      expected_amount_minor: number;
      paid_amount_minor: number | null;
    }[] | null) ?? []) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      expectedMinor += row.expected_amount_minor ?? 0;
      if (row.status === "VERIFIED") paidVerifiedMinor += row.paid_amount_minor ?? 0;
      if (row.status === "PENDING" || row.status === "UNDER_REVIEW") underReview += 1;
    }
    result.payment = { byStatus, expectedMinor, paidVerifiedMinor, underReview };
  }

  if (access.attendance) {
    const { data } = await supabase
      .from("attendance")
      .select("event_day, registrations:registration_id!inner (edition_id)")
      .eq("registrations.edition_id", editionId);
    const byDay: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (const row of (data as { event_day: number }[] | null) ?? []) {
      byDay[row.event_day] = (byDay[row.event_day] ?? 0) + 1;
    }
    result.attendance = { byDay };
  }

  if (access.food) {
    result.food = await getFoodStats(editionId);
  }

  return result;
}
