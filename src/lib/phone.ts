import { z } from "zod";

export const PHONE_DIGIT_COUNT = 10;
export const TEN_DIGIT_PHONE = /^\d{10}$/;
export const PHONE_HINT = "10 digits only, no country code.";
export const PHONE_ERROR = "Enter a 10-digit number. Digits only, no country code.";

export const phoneInputProps = {
  type: "tel" as const,
  inputMode: "numeric" as const,
  autoComplete: "tel-national" as const,
  maxLength: PHONE_DIGIT_COUNT,
  minLength: PHONE_DIGIT_COUNT,
  pattern: "[0-9]{10}",
};

export function isParticipantPhoneField(fieldKey: string): boolean {
  return fieldKey === "emergency_contact" || fieldKey === "phone";
}

export function isTenDigitPhone(value: string): boolean {
  return TEN_DIGIT_PHONE.test(value.trim());
}

export const tenDigitPhoneSchema = z.string().trim().regex(TEN_DIGIT_PHONE, PHONE_ERROR);
