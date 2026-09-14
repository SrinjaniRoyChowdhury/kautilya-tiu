export const APP_NAME = "Kautilya";

export const STAFF_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "PAYMENT_ADMIN",
  "REGISTRATION_ADMIN",
  "CONTENT_EDITOR",
  "DELEGATE_AFFAIRS",
  "VIEWER",
  "ATTENDANCE_OPERATOR",
  "FOOD_OPERATOR",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export { HARDCODED_TEAM } from "@/lib/team";

export const DEFAULT_REGISTRATION_FIELDS = [
  {
    field_key: "institution",
    label: "Institution / College",
    field_type: "text" as const,
    required: true,
    options: null,
    validation: { min: 2, max: 120 },
    display_order: 1,
    section: "PERSONAL" as const,
  },
  {
    field_key: "year_of_study",
    label: "Year of study",
    field_type: "select" as const,
    required: true,
    options: ["1", "2", "3", "4", "5", "Other"],
    validation: null,
    display_order: 2,
    section: "PERSONAL" as const,
  },
  {
    field_key: "emergency_contact",
    label: "Emergency contact number",
    field_type: "text" as const,
    required: true,
    options: null,
    validation: { regex: "^[0-9]{10}$" },
    display_order: 3,
    section: "PERSONAL" as const,
  },
  {
    field_key: "mun_experience",
    label: "Prior MUN experience",
    field_type: "select" as const,
    required: true,
    options: ["None", "1–3 conferences", "4–8 conferences", "9+ conferences"],
    validation: null,
    display_order: 4,
    section: "MUN_INFO" as const,
  },
  {
    field_key: "mun_experience_details",
    label: "Prior MUN experience details",
    field_type: "text" as const,
    required: false,
    options: null,
    validation: { max: 2000 },
    display_order: 5,
    section: "MUN_INFO" as const,
  },
];

export const RETIRED_REGISTRATION_FIELD_KEYS = [
  "portfolio_pref_1",
  "portfolio_pref_2",
  "dietary_notes",
  "accommodation",
] as const;

export const MUN_EXPERIENCE_FORMAT = "Event Name : Committee : Portfolio : Award Won";
export const MUN_EXPERIENCE_EXAMPLE = "NITISABHA 2025 : Loksabha : Narendra Modi : Best Delegate";

export const DEFAULT_MEAL_TYPES = ["Breakfast", "Lunch", "Snacks", "Dinner"];
