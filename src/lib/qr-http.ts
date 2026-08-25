export function rpcCode(error: { message?: string; code?: string } | null): string {
  const raw = (error?.message ?? error?.code ?? "").toUpperCase();
  for (const code of [
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "QR_NOT_FOUND",
    "QR_REVOKED",
    "NOT_CONFIRMED",
    "NOT_CONFIRMED_YET",
    "NOT_FOUND",
    "REASON_REQUIRED",
    "ALREADY_CHECKED_IN",
    "ALREADY_CHECKED_OUT",
    "ALREADY_COLLECTED",
    "NOT_CHECKED_IN",
    "INVALID_DAY",
    "MEAL_NOT_FOUND",
    "MEAL_REQUIRED",
  ]) {
    if (raw.includes(code)) return code;
  }
  return "ERROR";
}

export function qrHttpStatus(code: string): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "QR_NOT_FOUND":
    case "NOT_FOUND":
    case "NOT_CONFIRMED_YET":
    case "MEAL_NOT_FOUND":
      return 404;
    case "QR_REVOKED":
      return 410;
    case "NOT_CONFIRMED":
    case "ALREADY_CHECKED_IN":
    case "ALREADY_CHECKED_OUT":
    case "ALREADY_COLLECTED":
    case "NOT_CHECKED_IN":
      return 409;
    case "REASON_REQUIRED":
    case "INVALID_DAY":
    case "MEAL_REQUIRED":
      return 400;
    default:
      return 400;
  }
}

export const QR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sign in to continue.",
  FORBIDDEN: "You do not have permission to do that.",
  QR_NOT_FOUND: "That credential is not recognised.",
  QR_REVOKED: "This credential was revoked. Ask the desk for a new one.",
  NOT_CONFIRMED: "This registration is not confirmed.",
  NOT_CONFIRMED_YET: "Your credential appears after payment is verified.",
  NOT_FOUND: "Not found.",
  REASON_REQUIRED: "Enter a reason (at least 3 characters).",
  ALREADY_CHECKED_IN: "Already checked in.",
  ALREADY_CHECKED_OUT: "Already checked out.",
  ALREADY_COLLECTED: "This meal was already collected.",
  NOT_CHECKED_IN: "Not checked in for this day yet.",
  INVALID_DAY: "Choose day 1, 2, or 3.",
  MEAL_NOT_FOUND: "That meal is not on the schedule.",
  MEAL_REQUIRED: "Select a meal first.",
};

export function formatScanTime(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}
