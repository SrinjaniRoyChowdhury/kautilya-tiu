export type EditionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type CommitteeStatus = "OPEN" | "CLOSED" | "HIDDEN";

export type HeroStat = {
  label: string;
  value: string;
};

export type SiteSettings = {
  society_name: string;
  tagline: string | null;
  about_html: string | null;
  mission_html: string | null;
  history_html: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  hero_stats: HeroStat[];
};

export type Edition = {
  id: string;
  name: string;
  year: number;
  slug: string;
  theme: string | null;
  start_date: string | null;
  end_date: string | null;
  registration_open_at: string | null;
  registration_close_at: string | null;
  status: EditionStatus;
  is_public_active: boolean;
};

export type EbMember = {
  name: string;
  title: string;
};

export type Portfolio = {
  name: string;
};

export type Committee = {
  id: string;
  edition_id: string;
  name: string;
  short_name: string;
  slug: string;
  description: string | null;
  rules_url: string | null;
  capacity: number;
  confirmed_count: number;
  occupied_count?: number;
  fee_minor: number;
  eb_json: EbMember[];
  portfolio_config: Portfolio[];
  status: CommitteeStatus;
  display_order: number;
};

export type RegistrationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PAYMENT_PENDING"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_REJECTED"
  | "CONFIRMED"
  | "CANCELLED";

export type FoodPreference = "VEG" | "NON_VEG";

export type FieldType =
  | "text"
  | "number"
  | "select"
  | "multiselect"
  | "date"
  | "boolean"
  | "file";

export type FieldSection = "PERSONAL" | "MUN_INFO" | "FOOD" | "ADDITIONAL";

export type FieldValidation = {
  min?: number;
  max?: number;
  regex?: string;
};

export type RegistrationFieldDefinition = {
  id: string;
  edition_id: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  required: boolean;
  options: string[] | null;
  validation: FieldValidation | null;
  display_order: number;
  section: FieldSection;
};

export type Registration = {
  id: string;
  edition_id: string;
  user_id: string;
  committee_id: string | null;
  status: RegistrationStatus;
  food_preference: FoodPreference | null;
  expected_fee_minor: number | null;
  submitted_at: string | null;
  confirmed_at: string | null;
};

export type RegistrationFieldValue = {
  id: string;
  registration_id: string;
  field_definition_id: string;
  value_text: string | null;
  value_json: unknown;
};

export type Announcement = {
  id: string;
  edition_id: string | null;
  title: string;
  body_html: string;
  published_at: string | null;
};

export type TeamMember = {
  id: string;
  full_name: string;
  role_title: string;
  bio: string | null;
  photo_url: string | null;
  display_order: number;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  email_verified_at: string | null;
  status: "ACTIVE" | "SUSPENDED";
};

export type UserRoleRow = {
  id: string;
  user_id: string;
  edition_id: string | null;
  roles: { name: string } | { name: string }[] | null;
};
