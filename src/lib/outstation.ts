import { rupeesToMinor } from "@/lib/format";
import type { OutstationCheckIn, OutstationStudentType } from "@/types";

/** Fixed outstation fee schedule (rupees). Admin may still override at allotment. */
export const OUTSTATION_FEE_RUPEES = {
  SCHOOL: 15000,
  COLLEGE_NO_ACCOMMODATION: 2500,
  COLLEGE_ACCOMMODATION_NOV_26_NIGHT: 8000,
  COLLEGE_ACCOMMODATION_NOV_27_MORNING: 7000,
} as const;

export const OUTSTATION_STUDENT_TYPES = ["SCHOOL", "COLLEGE"] as const;

export const OUTSTATION_STUDENT_TYPE_LABELS: Record<OutstationStudentType, string> = {
  SCHOOL: "School student",
  COLLEGE: "College student",
};

export const OUTSTATION_CHECK_INS = ["NOV_26_NIGHT", "NOV_27_MORNING"] as const;

export const OUTSTATION_CHECK_IN_LABELS: Record<OutstationCheckIn, string> = {
  NOV_26_NIGHT: "Check in on 26th November night",
  NOV_27_MORNING: "Check in on 27th November morning",
};

export type OutstationFormValues = {
  is_outstation: boolean;
  outstation_student_type?: OutstationStudentType | "";
  outstation_needs_accommodation: boolean;
  outstation_check_in?: OutstationCheckIn | "";
};

export function normalizeOutstationPayload(input: {
  is_outstation: boolean;
  outstation_student_type?: string | null;
  outstation_needs_accommodation?: boolean;
  outstation_check_in?: string | null;
}): {
  is_outstation: boolean;
  outstation_student_type: OutstationStudentType | null;
  outstation_needs_accommodation: boolean;
  outstation_check_in: OutstationCheckIn | null;
} {
  if (!input.is_outstation) {
    return {
      is_outstation: false,
      outstation_student_type: null,
      outstation_needs_accommodation: false,
      outstation_check_in: null,
    };
  }

  const studentType =
    input.outstation_student_type === "SCHOOL" || input.outstation_student_type === "COLLEGE"
      ? input.outstation_student_type
      : null;
  const needsAccommodation =
    studentType === "COLLEGE" && Boolean(input.outstation_needs_accommodation);
  const checkIn =
    needsAccommodation &&
    (input.outstation_check_in === "NOV_26_NIGHT" || input.outstation_check_in === "NOV_27_MORNING")
      ? input.outstation_check_in
      : null;

  return {
    is_outstation: true,
    outstation_student_type: studentType,
    outstation_needs_accommodation: needsAccommodation,
    outstation_check_in: checkIn,
  };
}

export function outstationSummary(row: {
  is_outstation?: boolean | null;
  outstation_student_type?: OutstationStudentType | null;
  outstation_needs_accommodation?: boolean | null;
  outstation_check_in?: OutstationCheckIn | null;
}): string | null {
  if (!row.is_outstation) return null;
  const parts = ["Outstation"];
  if (row.outstation_student_type) {
    parts.push(OUTSTATION_STUDENT_TYPE_LABELS[row.outstation_student_type]);
  }
  if (row.outstation_needs_accommodation) {
    parts.push("Accommodation + meal");
    if (row.outstation_check_in) {
      parts.push(OUTSTATION_CHECK_IN_LABELS[row.outstation_check_in]);
    }
  }
  return parts.join(" · ");
}

/** Suggested fee in paise for allotment prefill. Null when options are incomplete. */
export function suggestedOutstationFeeMinor(row: {
  is_outstation?: boolean | null;
  outstation_student_type?: OutstationStudentType | null;
  outstation_needs_accommodation?: boolean | null;
  outstation_check_in?: OutstationCheckIn | null;
}): number | null {
  if (!row.is_outstation) return null;
  if (row.outstation_student_type === "SCHOOL") {
    return rupeesToMinor(OUTSTATION_FEE_RUPEES.SCHOOL);
  }
  if (row.outstation_student_type !== "COLLEGE") return null;
  if (!row.outstation_needs_accommodation) {
    return rupeesToMinor(OUTSTATION_FEE_RUPEES.COLLEGE_NO_ACCOMMODATION);
  }
  if (row.outstation_check_in === "NOV_26_NIGHT") {
    return rupeesToMinor(OUTSTATION_FEE_RUPEES.COLLEGE_ACCOMMODATION_NOV_26_NIGHT);
  }
  if (row.outstation_check_in === "NOV_27_MORNING") {
    return rupeesToMinor(OUTSTATION_FEE_RUPEES.COLLEGE_ACCOMMODATION_NOV_27_MORNING);
  }
  return null;
}
