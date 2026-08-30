export type EditionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type CommitteeStatus = "OPEN" | "CLOSED" | "HIDDEN";

export type HeroStat = {
  label: string;
  value: string;
};

/** Ordered CMS pick for /contact "Who reads the desk". */
export type ContactDeskFaceRef = {
  member_id: string;
  name: string;
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
  contact_desk_faces: ContactDeskFaceRef[];
  contact_desk_limit: number;
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
  photo_url?: string | null;
};

export type Portfolio = {
  slr?: number;
  name: string;
};

export type RegistrationPhaseKind = "EARLY_BIRD" | "PHASE_1" | "PHASE_2";
export type DelegationType = "SINGLE" | "DOUBLE";

export type RegistrationPhase = {
  id: string;
  edition_id: string;
  kind: RegistrationPhaseKind;
  is_active: boolean;
};

export type PrizeMoneyEntry = {
  category: string;
  amount_minor: number;
};

export type CommitteePhaseFee = {
  id?: string;
  committee_id: string;
  phase_id: string;
  kind?: RegistrationPhaseKind;
  single_fee_minor: number;
  double_fee_minor: number;
};

export type EditionExpense = {
  id: string;
  edition_id: string;
  title: string;
  category: string | null;
  amount_minor: number;
  incurred_on: string;
  notes: string | null;
  created_at?: string;
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
  double_fee_minor?: number;
  current_phase_kind?: RegistrationPhaseKind | null;
  allows_single_del?: boolean;
  allows_double_del?: boolean;
  eb_json: EbMember[];
  logo_url?: string | null;
  card_background_url?: string | null;
  portfolio_config: Portfolio[];
  prize_money_json?: PrizeMoneyEntry[];
  show_prize_money?: boolean;
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
  accepted_rules_at?: string | null;
  allocated_slr?: number | null;
  allocated_portfolio?: string | null;
  collective_id?: string | null;
  delegation_type?: DelegationType;
  partner_email?: string | null;
  partner_registration_id?: string | null;
  pair_id?: string | null;
  is_pair_lead?: boolean;
  partner_name?: string | null;
};

export type Collective = {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type Institution = Collective;

export type ConferenceDocument = {
  kind: "rulebook" | "guidelines";
  file_name: string;
  storage_key: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  email_verified_at: string | null;
  status: "ACTIVE" | "SUSPENDED";
  created_at: string;
  registration_id?: string | null;
  registration_status?: RegistrationStatus | null;
  committee_short_name?: string | null;
};

export type AdminParticipant = {
  id: string;
  edition_id: string;
  user_id: string;
  full_name: string;
  email: string;
  status: RegistrationStatus;
  committee_short_name: string | null;
  food_preference: FoodPreference | null;
  paid: boolean;
  collective_name?: string | null;
  delegation_type?: DelegationType | null;
  partner_email?: string | null;
  allocated_slr?: number | null;
  allocated_portfolio?: string | null;
  display_code?: string | null;
};

export type FoodCollectionRow = {
  id: string;
  meal_schedule_id: string;
  event_day: number;
  meal_name: string;
  full_name: string;
  email: string;
  committee_short_name: string | null;
  collected_at: string;
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
  published?: boolean;
  published_at: string | null;
  display_order?: number;
};

export type TeamSection = "CORE" | "USG";

export type TeamMember = {
  id: string;
  edition_id?: string | null;
  section?: TeamSection;
  full_name: string;
  role_title: string;
  bio: string | null;
  photo_url: string | null;
  display_order: number;
  published?: boolean;
};

export type SponsorCategory = "title" | "gold" | "silver" | "partner";

export type CollaboratorCategory = "society" | "institution" | "media" | "partner";

export type CmsSponsor = {
  id: string;
  edition_id?: string | null;
  name: string;
  category: SponsorCategory;
  logo_url: string | null;
  display_order: number;
  published?: boolean;
};

export type CmsCollaborator = {
  id: string;
  edition_id?: string | null;
  name: string;
  category: CollaboratorCategory;
  logo_url: string | null;
  display_order: number;
  published?: boolean;
};

export type GalleryAlbum = {
  id: string;
  edition_id: string;
  title: string;
  description: string | null;
  published: boolean;
  display_order: number;
  images?: GalleryImage[];
};

export type GalleryImage = {
  id: string;
  album_id: string;
  storage_key: string;
  caption: string | null;
  display_order: number;
};

export type AuditLog = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
  actor_name: string | null;
  actor_email: string | null;
};

export type Profile = {
  id: string;
  email: string;
  username?: string | null;
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

export type ScannerAssignment = {
  id: string;
  user_id: string;
  edition_id: string | null;
  role_name: string;
  full_name: string;
  email: string;
  edition_name: string | null;
  password_plain?: string | null;
};

export type StaffAccount = {
  user_id: string;
  assignment_ids: string[];
  full_name: string;
  username: string | null;
  email: string;
  password_plain: string | null;
  kind: "scanner" | "editor" | "delegate_affairs" | "viewer";
  role_names: string[];
  desk: "attendance" | "food" | "both" | null;
  edition_id: string | null;
  edition_name: string | null;
};

export type CommitteeDelegate = {
  id: string;
  full_name: string;
  email: string;
  status: RegistrationStatus;
  allocated_slr: number | null;
  allocated_portfolio: string | null;
  pair_id?: string | null;
  is_pair_lead?: boolean;
  partner_name?: string | null;
};

export type PaymentStatus =
  | "DRAFT"
  | "PENDING"
  | "UNDER_REVIEW"
  | "VERIFIED"
  | "REJECTED"
  | "CANCELLED";

export type AmountFlag = "UNDERPAID" | "EXACT" | "OVERPAID" | "UNKNOWN";

export type PaymentInstructions = {
  id: string;
  edition_id: string;
  upi_id: string | null;
  upi_qr_image_key: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  ifsc: string | null;
  notes: string | null;
};

export type Payment = {
  id: string;
  edition_id: string;
  payer_user_id: string;
  expected_amount_minor: number;
  paid_amount_minor: number | null;
  currency: string;
  status: PaymentStatus;
  amount_flag: AmountFlag;
  proof_image_key: string | null;
  proof_sha256?: string | null;
  transaction_ref: string | null;
  paid_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PaymentParticipant = {
  id: string;
  payment_id: string;
  registration_id: string | null;
  user_id: string | null;
  unmatched_email: string | null;
  amount_minor: number;
  created_at?: string;
  users?: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
  registrations?: {
    status: RegistrationStatus;
    expected_fee_minor: number | null;
    users?: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
    committees?: { short_name: string; name: string } | { short_name: string; name: string }[] | null;
  } | null;
};

export type PaymentWithParticipants = Payment & {
  payment_participants: PaymentParticipant[];
  payer?: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
};

export type QrToken = {
  id: string;
  registration_id: string;
  display_code: string;
  status: "ACTIVE" | "REVOKED";
  issued_at: string;
};

export type ConfirmedCredential = {
  id: string;
  edition_id: string;
  full_name: string;
  email: string;
  food_preference: FoodPreference | null;
  committee_short_name: string | null;
  committee_name: string | null;
  display_code: string | null;
  allocated_slr: number | null;
  allocated_portfolio: string | null;
  collective_name?: string | null;
};

export type MealSchedule = {
  id: string;
  edition_id: string;
  event_day: number;
  meal_type_id: string;
  starts_at: string | null;
  name: string;
};

export type AttendanceRow = {
  id: string;
  registration_id: string;
  event_day: number;
  checked_in_at: string;
  checked_out_at: string | null;
  method: "QR_SCAN" | "MANUAL";
  notes: string | null;
  full_name?: string;
  email?: string;
  committee_short_name?: string | null;
};

export type EventStatus = {
  attendance: Array<{
    event_day: number;
    checked_in_at: string;
    checked_out_at: string | null;
  }>;
  meals: Array<{
    event_day: number;
    meal_name: string;
    collected_at: string;
  }>;
};

export type FoodStat = {
  meal_schedule_id: string;
  event_day: number;
  meal_name: string;
  collected: number;
};
