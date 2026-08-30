import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isConferenceMeal } from "@/lib/meals";
import { normalizePortfolios } from "@/lib/sheet";
import { deskFromRoleNames, kindFromRoleNames } from "@/lib/username";
import type {
  AdminParticipant,
  Announcement,
  AuditLog,
  Collective,
  Committee,
  CommitteeDelegate,
  CommitteePhaseFee,
  ConferenceDocument,
  Edition,
  EditionExpense,
  Payment,
  PaymentInstructions,
  PaymentWithParticipants,
  ConfirmedCredential,
  EventStatus,
  FoodCollectionRow,
  FoodStat,
  GalleryAlbum,
  GalleryImage,
  Institution,
  MealSchedule,
  AttendanceRow,
  QrToken,
  Registration,
  RegistrationFieldDefinition,
  RegistrationFieldValue,
  RegistrationPhase,
  SiteSettings,
  TeamMember,
  StaffAccount,
  AdminUser,
} from "@/types";

const fallbackSettings: SiteSettings = {
  society_name: "Niti Sabha",
  tagline: "Strategy. Diplomacy. Statecraft.",
  about_html: null,
  mission_html: null,
  history_html: null,
  contact_email: "tiukautilya@gmail.com",
  contact_phone: "9049064408",
  contact_address: "Techno India University, West Bengal, India",
  instagram_url: "https://www.instagram.com/kautilya_tiu/",
  linkedin_url: null,
  hero_stats: [],
};

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("site_settings").select("*").eq("id", true).maybeSingle();
    const row = (data as SiteSettings | null) ?? fallbackSettings;
    return {
      ...row,
      hero_stats: Array.isArray(row.hero_stats) ? row.hero_stats : [],
    };
  } catch {
    return fallbackSettings;
  }
}

export async function getPublicEditions(): Promise<Edition[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("mun_editions")
      .select(
        "id, name, year, slug, theme, start_date, end_date, registration_open_at, registration_close_at, status, is_public_active",
      )
      .in("status", ["PUBLISHED", "ARCHIVED"])
      .is("deleted_at", null)
      .order("year", { ascending: false });
    return (data as Edition[]) ?? [];
  } catch {
    return [];
  }
}

export async function getActiveEdition(): Promise<Edition | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("mun_editions")
      .select(
        "id, name, year, slug, theme, start_date, end_date, registration_open_at, registration_close_at, status, is_public_active",
      )
      .eq("is_public_active", true)
      .eq("status", "PUBLISHED")
      .is("deleted_at", null)
      .maybeSingle();
    if (data) return data as Edition;
    const editions = await getPublicEditions();
    return editions.find((e) => e.status === "PUBLISHED") ?? null;
  } catch {
    return null;
  }
}

export async function getEditionBySlug(slug: string): Promise<Edition | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mun_editions")
    .select(
      "id, name, year, slug, theme, start_date, end_date, registration_open_at, registration_close_at, status, is_public_active",
    )
    .eq("slug", slug)
    .in("status", ["PUBLISHED", "ARCHIVED"])
    .is("deleted_at", null)
    .maybeSingle();
  return (data as Edition | null) ?? null;
}

export async function getEditionById(id: string): Promise<Edition | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mun_editions")
    .select(
      "id, name, year, slug, theme, start_date, end_date, registration_open_at, registration_close_at, status, is_public_active",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as Edition | null) ?? null;
}

const COMMITTEE_SELECT =
  "id, edition_id, name, short_name, slug, description, rules_url, logo_url, capacity, confirmed_count, fee_minor, eb_json, portfolio_config, status, display_order, allows_single_del, allows_double_del";

const REGISTRATION_SELECT =
  "id, edition_id, user_id, committee_id, status, food_preference, expected_fee_minor, submitted_at, confirmed_at, accepted_rules_at, allocated_slr, allocated_portfolio, collective_id, delegation_type, partner_email, partner_registration_id, pair_id, is_pair_lead";

function hydrateCommittee(committee: Committee): Committee {
  const portfolio_config = normalizePortfolios(committee.portfolio_config);
  return {
    ...committee,
    portfolio_config,
    capacity: portfolio_config.length || committee.capacity,
  };
}

export async function getCommitteesForEdition(editionId: string): Promise<Committee[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("committees")
    .select(COMMITTEE_SELECT)
    .eq("edition_id", editionId)
    .is("deleted_at", null)
    .order("display_order", { ascending: true });
  return attachCurrentFees(
    await attachOccupancy(editionId, ((data as Committee[]) ?? []).map(hydrateCommittee)),
  );
}

export async function getPublicCommittees(editionId: string): Promise<Committee[]> {
  const all = await getCommitteesForEdition(editionId);
  return all.filter((c) => c.status === "OPEN" || c.status === "CLOSED");
}

export async function getCommitteeBySlug(
  editionId: string,
  slug: string,
): Promise<Committee | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("committees")
    .select(COMMITTEE_SELECT)
    .eq("edition_id", editionId)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const [committee] = await attachCurrentFees(
    await attachOccupancy(editionId, [hydrateCommittee(data as Committee)]),
  );
  return committee ?? null;
}

export async function getAnnouncements(editionId?: string | null): Promise<Announcement[]> {
  noStore();
  const supabase = await createClient();
  let query = supabase
    .from("announcements")
    .select("id, edition_id, title, body_html, published_at")
    .eq("published", true)
    .order("display_order", { ascending: true });
  if (editionId) query = query.or(`edition_id.eq.${editionId},edition_id.is.null`);
  const { data } = await query;
  return (data as Announcement[]) ?? [];
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cms_team_members")
    .select("id, section, full_name, role_title, bio, photo_url, display_order")
    .eq("published", true)
    .order("display_order", { ascending: true });
  return (data as TeamMember[]) ?? [];
}

export async function getCommitteeById(id: string): Promise<Committee | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("committees")
    .select(COMMITTEE_SELECT)
    .eq("id", id)
    .maybeSingle();
  return data ? (await attachCurrentFees([hydrateCommittee(data as Committee)]))[0] ?? null : null;
}

export async function getCommitteeDelegates(committeeId: string): Promise<CommitteeDelegate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("registrations")
    .select(
      "id, status, allocated_slr, allocated_portfolio, pair_id, is_pair_lead, partner_email, users:user_id (full_name, email)",
    )
    .eq("committee_id", committeeId)
    .is("deleted_at", null)
    .neq("status", "CANCELLED")
    .order("confirmed_at", { ascending: false, nullsFirst: false });
  type Row = {
    id: string;
    status: CommitteeDelegate["status"];
    allocated_slr: number | null;
    allocated_portfolio: string | null;
    pair_id: string | null;
    is_pair_lead: boolean;
    partner_email: string | null;
    users: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
  };
  const mapped = ((data as Row[] | null) ?? []).map((row) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
      id: row.id,
      full_name: user?.full_name ?? "Delegate",
      email: user?.email ?? "",
      status: row.status,
      allocated_slr: row.allocated_slr,
      allocated_portfolio: row.allocated_portfolio,
      pair_id: row.pair_id,
      is_pair_lead: row.is_pair_lead,
      partner_name: row.partner_email,
    };
  });
  return mapped.map((row) => {
    if (!row.pair_id) return row;
    const partner = mapped.find((item) => item.pair_id === row.pair_id && item.id !== row.id);
    return { ...row, partner_name: partner ? partner.full_name : row.partner_name };
  });
}

export async function getAllEditionsAdmin(): Promise<Edition[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mun_editions")
    .select(
      "id, name, year, slug, theme, start_date, end_date, registration_open_at, registration_close_at, status, is_public_active",
    )
    .is("deleted_at", null)
    .order("year", { ascending: false });
  return (data as Edition[]) ?? [];
}

export async function getManagedStaffAccounts(): Promise<StaffAccount[]> {
  const supabase = await createClient();
  const [{ data }, editions, secretsRes] = await Promise.all([
    supabase
      .from("user_roles")
      .select("id, user_id, edition_id, roles(name), users(full_name, email, username)")
      .order("created_at", { ascending: false }),
    getAllEditionsAdmin(),
    supabase.from("scanner_secrets").select("user_id, password_plain"),
  ]);
  const editionName = new Map(editions.map((item) => [item.id, item.name]));
  const secrets = new Map(
    ((secretsRes.data ?? []) as Array<{ user_id: string; password_plain: string }>).map((row) => [
      row.user_id,
      row.password_plain,
    ]),
  );
  const rows = (data ?? []) as Array<{
    id: string;
    user_id: string;
    edition_id: string | null;
    roles: { name: string } | { name: string }[] | null;
    users:
      | { full_name: string; email: string; username: string | null }
      | { full_name: string; email: string; username: string | null }[]
      | null;
  }>;

  const grouped = new Map<
    string,
    {
      user_id: string;
      assignment_ids: string[];
      role_names: string[];
      full_name: string;
      username: string | null;
      email: string;
      edition_id: string | null;
    }
  >();

  for (const row of rows) {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    const kind = kindFromRoleNames(role ? [role.name] : []);
    if (!kind || !role) continue;
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const current = grouped.get(row.user_id);
    if (current) {
      current.assignment_ids.push(row.id);
      if (!current.role_names.includes(role.name)) current.role_names.push(role.name);
      if (!current.edition_id && row.edition_id) current.edition_id = row.edition_id;
      continue;
    }
    grouped.set(row.user_id, {
      user_id: row.user_id,
      assignment_ids: [row.id],
      role_names: [role.name],
      full_name: user?.full_name ?? "Staff",
      username: user?.username ?? null,
      email: user?.email ?? "",
      edition_id: row.edition_id,
    });
  }

  return [...grouped.values()].map((person) => {
    const kind = kindFromRoleNames(person.role_names) ?? "viewer";
    return {
      user_id: person.user_id,
      assignment_ids: person.assignment_ids,
      full_name: person.full_name,
      username: person.username,
      email: person.email,
      password_plain: secrets.get(person.user_id) ?? null,
      kind,
      role_names: person.role_names,
      desk: deskFromRoleNames(person.role_names),
      edition_id: person.edition_id,
      edition_name: person.edition_id ? (editionName.get(person.edition_id) ?? null) : null,
    };
  });
}

async function attachOccupancy(editionId: string, committees: Committee[]): Promise<Committee[]> {
  if (!committees.length) return committees;
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("edition_committee_occupancy", {
      p_edition_id: editionId,
    });
    const taken = new Map<string, number>(
      ((data as { committee_id: string; seats_taken: number }[]) ?? []).map((row) => [
        row.committee_id,
        row.seats_taken,
      ]),
    );
    return committees.map((committee) => ({
      ...committee,
      occupied_count: taken.get(committee.id) ?? 0,
    }));
  } catch {
    return committees.map((committee) => ({
      ...committee,
      occupied_count: committee.confirmed_count,
    }));
  }
}

async function attachCurrentFees(committees: Committee[]): Promise<Committee[]> {
  if (!committees.length) return committees;
  const supabase = await createClient();
  const editionIds = [...new Set(committees.map((item) => item.edition_id))];
  const ids = committees.map((item) => item.id);
  const [{ data: phases }, { data: fees }] = await Promise.all([
    supabase
      .from("registration_phases")
      .select("id, edition_id, kind, is_active")
      .in("edition_id", editionIds),
    supabase
      .from("committee_phase_fees")
      .select("committee_id, phase_id, single_fee_minor, double_fee_minor")
      .in("committee_id", ids),
  ]);
  const active = new Map(
    ((phases as RegistrationPhase[] | null) ?? [])
      .filter((phase) => phase.is_active)
      .map((phase) => [phase.edition_id, phase]),
  );
  const feeRows = (fees as CommitteePhaseFee[] | null) ?? [];
  return committees.map((committee) => {
    const phase = active.get(committee.edition_id);
    const row = feeRows.find(
      (item) => item.committee_id === committee.id && item.phase_id === phase?.id,
    );
    return {
      ...committee,
      current_phase_kind: phase?.kind ?? null,
      fee_minor: row?.single_fee_minor ?? committee.fee_minor,
      double_fee_minor: row?.double_fee_minor ?? committee.fee_minor,
      allows_single_del: committee.allows_single_del ?? true,
      allows_double_del: committee.allows_double_del ?? false,
    };
  });
}

export async function getFieldDefinitions(
  editionId: string,
): Promise<RegistrationFieldDefinition[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("registration_field_definitions")
    .select(
      "id, edition_id, field_key, label, field_type, required, options, validation, display_order, section",
    )
    .eq("edition_id", editionId)
    .order("display_order", { ascending: true });
  return (data as RegistrationFieldDefinition[]) ?? [];
}

export async function getMyRegistration(editionId: string): Promise<Registration | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("registrations")
    .select(REGISTRATION_SELECT)
    .eq("edition_id", editionId)
    .eq("user_id", user.id)
    .neq("status", "CANCELLED")
    .is("deleted_at", null)
    .maybeSingle();
  return withPartnerName((data as Registration | null) ?? null);
}

async function withPartnerName(row: Registration | null): Promise<Registration | null> {
  if (!row?.partner_email) return row;
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("full_name")
    .eq("email", row.partner_email)
    .maybeSingle();
  return { ...row, partner_name: (data as { full_name: string } | null)?.full_name ?? row.partner_email };
}

export async function getRegistrationValues(
  registrationId: string,
): Promise<RegistrationFieldValue[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("registration_field_values")
    .select("id, registration_id, field_definition_id, value_text, value_json")
    .eq("registration_id", registrationId);
  return (data as RegistrationFieldValue[]) ?? [];
}

const PAYMENT_SELECT = `
  id, edition_id, payer_user_id, expected_amount_minor, paid_amount_minor, currency,
  status, amount_flag, proof_image_key, proof_sha256, transaction_ref, paid_at,
  verified_by, verified_at, rejection_reason, created_at, updated_at
`;

const PARTICIPANT_SELECT = `
  id, payment_id, registration_id, user_id, unmatched_email, amount_minor, created_at,
  users:user_id (full_name, email),
  registrations:registration_id (
    status, expected_fee_minor,
    users:user_id (full_name, email),
    committees:committee_id (short_name, name)
  )
`;

export async function getPaymentInstructions(
  editionId: string,
): Promise<PaymentInstructions | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_instructions")
    .select(
      "id, edition_id, upi_id, upi_qr_image_key, bank_name, account_name, account_number, ifsc, notes",
    )
    .eq("edition_id", editionId)
    .maybeSingle();
  return (data as PaymentInstructions | null) ?? null;
}

function asPayments(data: unknown): PaymentWithParticipants[] {
  const rows = (data as PaymentWithParticipants[] | null) ?? [];
  return rows.map((row) => ({
    ...row,
    payment_participants: row.payment_participants ?? [],
  }));
}

function asPayment(data: unknown): PaymentWithParticipants | null {
  if (!data) return null;
  const row = data as PaymentWithParticipants;
  return { ...row, payment_participants: row.payment_participants ?? [] };
}

export async function getMyPayments(editionId: string): Promise<PaymentWithParticipants[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("payments")
    .select(`${PAYMENT_SELECT}, payment_participants (${PARTICIPANT_SELECT})`)
    .eq("edition_id", editionId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return asPayments(data);
}

export async function getPaymentById(id: string): Promise<PaymentWithParticipants | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select(
      `${PAYMENT_SELECT}, payment_participants (${PARTICIPANT_SELECT}), payer:users!payer_user_id (full_name, email)`,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return asPayment(data);
}

export async function getCoveringPaymentForRegistration(
  registrationId: string,
): Promise<Payment | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_participants")
    .select(`payments (${PAYMENT_SELECT})`)
    .eq("registration_id", registrationId);
  const rows = (data as unknown as { payments: Payment | Payment[] | null }[] | null) ?? [];
  const payments = rows.flatMap((row) => {
    const pay = row.payments;
    if (!pay) return [];
    return Array.isArray(pay) ? pay : [pay];
  });
  return (
    payments.find((item) => item.status === "UNDER_REVIEW" || item.status === "VERIFIED") ??
    payments.find((item) => item.status === "PENDING" || item.status === "REJECTED") ??
    payments[0] ??
    null
  );
}

export async function getConfirmedCredentials(
  editionId?: string | null,
): Promise<ConfirmedCredential[]> {
  const supabase = await createClient();
  let query = supabase
    .from("registrations")
    .select(
      `id, edition_id, food_preference, allocated_slr, allocated_portfolio,
       users:user_id (full_name, email),
       committees:committee_id (short_name, name),
       collectives:collective_id (name),
       qr_tokens (display_code, status, issued_at)`,
    )
    .eq("status", "CONFIRMED")
    .is("deleted_at", null)
    .order("confirmed_at", { ascending: false });
  if (editionId) query = query.eq("edition_id", editionId);
  const { data } = await query;
  type Row = {
    id: string;
    edition_id: string;
    food_preference: ConfirmedCredential["food_preference"];
    allocated_slr: number | null;
    allocated_portfolio: string | null;
    users: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
    committees:
      | { short_name: string; name: string }
      | { short_name: string; name: string }[]
      | null;
    collectives: { name: string } | { name: string }[] | null;
    qr_tokens:
      | { display_code: string; status: string; issued_at: string }[]
      | { display_code: string; status: string; issued_at: string }
      | null;
  };
  return ((data as Row[] | null) ?? []).map((row) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const committee = Array.isArray(row.committees) ? row.committees[0] : row.committees;
    const collective = Array.isArray(row.collectives) ? row.collectives[0] : row.collectives;
    const tokens = Array.isArray(row.qr_tokens) ? row.qr_tokens : row.qr_tokens ? [row.qr_tokens] : [];
    const active = tokens.find((item) => item.status === "ACTIVE") ?? null;
    return {
      id: row.id,
      edition_id: row.edition_id,
      full_name: user?.full_name ?? "Delegate",
      email: user?.email ?? "",
      food_preference: row.food_preference,
      committee_short_name: committee?.short_name ?? null,
      committee_name: committee?.name ?? null,
      display_code: active?.display_code ?? null,
      allocated_slr: row.allocated_slr,
      allocated_portfolio: row.allocated_portfolio,
      collective_name: collective?.name ?? null,
    };
  });
}

export async function getActiveQrForRegistration(registrationId: string): Promise<QrToken | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("qr_tokens")
    .select("id, registration_id, display_code, status, issued_at")
    .eq("registration_id", registrationId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  return (data as QrToken | null) ?? null;
}

export function paymentProofHref(
  paymentId: string,
  proofKey: string | null | undefined,
): string | null {
  if (!proofKey) return null;
  return `/api/payments/${encodeURIComponent(paymentId)}/proof`;
}

export async function getAdminPayments(editionId?: string | null): Promise<PaymentWithParticipants[]> {
  const supabase = await createClient();
  let query = supabase
    .from("payments")
    .select(
      `${PAYMENT_SELECT}, payment_participants (${PARTICIPANT_SELECT}), payer:users!payer_user_id (full_name, email)`,
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (editionId) query = query.eq("edition_id", editionId);
  const { data } = await query;
  return asPayments(data);
}

export async function getDuplicateProofPayments(
  sha256: string | null | undefined,
  excludeId: string,
): Promise<Pick<Payment, "id" | "status">[]> {
  if (!sha256) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, status")
    .eq("proof_sha256", sha256)
    .neq("id", excludeId)
    .is("deleted_at", null);
  return (data as Pick<Payment, "id" | "status">[]) ?? [];
}

export async function getPendingPaymentCount(editionId?: string | null): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .in("status", ["PENDING", "UNDER_REVIEW"])
    .is("deleted_at", null);
  if (editionId) query = query.eq("edition_id", editionId);
  const { count } = await query;
  return count ?? 0;
}

export async function getMealSchedules(editionId: string): Promise<MealSchedule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meal_schedules")
    .select("id, edition_id, event_day, meal_type_id, starts_at, meal_types (name, display_order)")
    .eq("edition_id", editionId)
    .order("event_day", { ascending: true });
  type Row = {
    id: string;
    edition_id: string;
    event_day: number;
    meal_type_id: string;
    starts_at: string | null;
    meal_types: { name: string; display_order: number } | { name: string; display_order: number }[] | null;
  };
  return ((data as Row[] | null) ?? [])
    .map((row) => {
      const meal = Array.isArray(row.meal_types) ? row.meal_types[0] : row.meal_types;
      return {
        id: row.id,
        edition_id: row.edition_id,
        event_day: row.event_day,
        meal_type_id: row.meal_type_id,
        starts_at: row.starts_at,
        name: meal?.name ?? "Meal",
        order: meal?.display_order ?? 0,
      };
    })
    .sort((a, b) => a.event_day - b.event_day || a.order - b.order)
    .filter((row) => isConferenceMeal(row.name))
    .map((row) => ({
      id: row.id,
      edition_id: row.edition_id,
      event_day: row.event_day,
      meal_type_id: row.meal_type_id,
      starts_at: row.starts_at,
      name: row.name,
    }));
}

export async function getMyEventStatus(registrationId: string): Promise<EventStatus> {
  const supabase = await createClient();
  const [{ data: attendance }, { data: meals }] = await Promise.all([
    supabase
      .from("attendance")
      .select("event_day, checked_in_at, checked_out_at")
      .eq("registration_id", registrationId)
      .order("event_day"),
    supabase
      .from("food_distribution")
      .select("collected_at, meal_schedules (event_day, meal_types (name))")
      .eq("registration_id", registrationId),
  ]);
  type MealRow = {
    collected_at: string;
    meal_schedules:
      | { event_day: number; meal_types: { name: string } | { name: string }[] | null }
      | { event_day: number; meal_types: { name: string } | { name: string }[] | null }[]
      | null;
  };
  return {
    attendance: (attendance as EventStatus["attendance"]) ?? [],
    meals: ((meals as MealRow[] | null) ?? []).map((row) => {
      const schedule = Array.isArray(row.meal_schedules) ? row.meal_schedules[0] : row.meal_schedules;
      const meal = Array.isArray(schedule?.meal_types) ? schedule?.meal_types[0] : schedule?.meal_types;
      return {
        event_day: schedule?.event_day ?? 0,
        meal_name: meal?.name ?? "Meal",
        collected_at: row.collected_at,
      };
    }),
  };
}

export async function getAttendanceRoll(
  editionId: string,
  eventDay?: number | null,
): Promise<AttendanceRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("attendance")
    .select(
      `id, registration_id, event_day, checked_in_at, checked_out_at, method, notes,
       registrations:registration_id!inner (
         edition_id,
         users:user_id (full_name, email),
         committees:committee_id (short_name)
       )`,
    )
    .eq("registrations.edition_id", editionId)
    .order("checked_in_at", { ascending: false });
  if (eventDay) query = query.eq("event_day", eventDay);
  const { data } = await query;
  type Row = {
    id: string;
    registration_id: string;
    event_day: number;
    checked_in_at: string;
    checked_out_at: string | null;
    method: AttendanceRow["method"];
    notes: string | null;
    registrations:
      | {
          edition_id: string;
          users: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
          committees: { short_name: string } | { short_name: string }[] | null;
        }
      | {
          edition_id: string;
          users: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
          committees: { short_name: string } | { short_name: string }[] | null;
        }[]
      | null;
  };
  const rows: AttendanceRow[] = [];
  for (const row of (data as Row[] | null) ?? []) {
    const registration = Array.isArray(row.registrations) ? row.registrations[0] : row.registrations;
    if (!registration) continue;
    const user = Array.isArray(registration.users) ? registration.users[0] : registration.users;
    const committee = Array.isArray(registration.committees)
      ? registration.committees[0]
      : registration.committees;
    rows.push({
      id: row.id,
      registration_id: row.registration_id,
      event_day: row.event_day,
      checked_in_at: row.checked_in_at,
      checked_out_at: row.checked_out_at,
      method: row.method,
      notes: row.notes,
      full_name: user?.full_name ?? "Delegate",
      email: user?.email ?? "",
      committee_short_name: committee?.short_name ?? null,
    });
  }
  return rows;
}

export async function getFoodStats(editionId: string): Promise<FoodStat[]> {
  const schedules = await getMealSchedules(editionId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("food_distribution")
    .select("meal_schedule_id, meal_schedules!inner (edition_id)");
  type Row = {
    meal_schedule_id: string;
    meal_schedules: { edition_id: string } | { edition_id: string }[] | null;
  };
  const counts = new Map<string, number>();
  for (const row of (data as Row[] | null) ?? []) {
    const schedule = Array.isArray(row.meal_schedules) ? row.meal_schedules[0] : row.meal_schedules;
    if (schedule?.edition_id !== editionId) continue;
    counts.set(row.meal_schedule_id, (counts.get(row.meal_schedule_id) ?? 0) + 1);
  }
  return schedules.map((meal) => ({
    meal_schedule_id: meal.id,
    event_day: meal.event_day,
    meal_name: meal.name,
    collected: counts.get(meal.id) ?? 0,
  }));
}

export function eventDayFromEdition(startDate?: string | null): number {
  if (!startDate) return 1;
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 1;
  const now = new Date();
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((todayUtc - startUtc) / 86_400_000) + 1;
  return Math.min(3, Math.max(1, diff));
}

export async function getAnnouncementsAdmin(): Promise<Announcement[]> {
  noStore();
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, edition_id, title, body_html, published, published_at, display_order")
    .order("display_order", { ascending: true });
  return (data as Announcement[]) ?? [];
}

export async function getTeamMembersAdmin(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cms_team_members")
    .select("id, edition_id, section, full_name, role_title, bio, photo_url, display_order, published")
    .order("display_order", { ascending: true });
  return (data as TeamMember[]) ?? [];
}

export async function getGalleryAlbums(publishedOnly = true): Promise<GalleryAlbum[]> {
  const supabase = await createClient();
  let query = supabase
    .from("gallery_albums")
    .select(
      "id, edition_id, title, description, published, display_order, gallery_images (id, album_id, storage_key, caption, display_order)",
    )
    .order("display_order", { ascending: true });
  if (publishedOnly) query = query.eq("published", true);
  const { data } = await query;
  type Row = GalleryAlbum & {
    gallery_images?: GalleryImage[] | null;
  };
  return ((data as Row[] | null) ?? []).map((row) => {
    const images = [...(row.gallery_images ?? [])].sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
    );
    return {
      id: row.id,
      edition_id: row.edition_id,
      title: row.title,
      description: row.description,
      published: row.published,
      display_order: row.display_order,
      images,
    };
  });
}

export async function getAuditLogs(opts?: {
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select(
      "id, actor_user_id, action, entity, entity_id, old_value, new_value, created_at, users:actor_user_id (full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 400);
  if (opts?.action) query = query.eq("action", opts.action);
  if (opts?.from) query = query.gte("created_at", opts.from);
  if (opts?.to) query = query.lte("created_at", opts.to);
  const { data } = await query;
  type Row = {
    id: string;
    actor_user_id: string | null;
    action: string;
    entity: string;
    entity_id: string | null;
    old_value: unknown;
    new_value: unknown;
    created_at: string;
    users: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
  };
  return ((data as Row[] | null) ?? []).map((row) => {
    const actor = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
      id: row.id,
      actor_user_id: row.actor_user_id,
      action: row.action,
      entity: row.entity,
      entity_id: row.entity_id,
      old_value: row.old_value,
      new_value: row.new_value,
      created_at: row.created_at,
      actor_name: actor?.full_name ?? null,
      actor_email: actor?.email ?? null,
    };
  });
}

export async function getPaymentIdsForParticipants(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.from("payment_participants").select("id, payment_id").in("id", unique);
  for (const row of (data as Array<{ id: string; payment_id: string }> | null) ?? []) {
    if (row.id && row.payment_id) map.set(row.id, row.payment_id);
  }
  return map;
}

export async function getAuditActions(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("audit_logs").select("action").limit(2000);
  const set = new Set(
    ((data as Array<{ action: string }> | null) ?? []).map((row) => row.action).filter(Boolean),
  );
  return [...set].sort((a, b) => a.localeCompare(b));
}

export async function getAdminParticipants(editionId?: string | null): Promise<AdminParticipant[]> {
  const supabase = await createClient();
  let query = supabase
    .from("registrations")
    .select(
      `id, edition_id, user_id, status, food_preference, delegation_type, partner_email,
       confirmed_free,
       allocated_slr, allocated_portfolio,
       users:user_id (full_name, email),
       committees:committee_id (short_name),
       collectives:collective_id (name),
       institutions:institution_id (name),
       qr_tokens (display_code, status, issued_at)`,
    )
    .is("deleted_at", null)
    .neq("status", "CANCELLED")
    .order("submitted_at", { ascending: false, nullsFirst: false });
  if (editionId) query = query.eq("edition_id", editionId);
  const { data } = await query;
  type Row = {
    id: string;
    edition_id: string;
    user_id: string;
    status: AdminParticipant["status"];
    food_preference: AdminParticipant["food_preference"];
    delegation_type: AdminParticipant["delegation_type"];
    partner_email: string | null;
    allocated_slr: number | null;
    allocated_portfolio: string | null;
    confirmed_free: boolean;
    users: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
    committees: { short_name: string } | { short_name: string }[] | null;
    collectives: { name: string } | { name: string }[] | null;
    institutions: { name: string } | { name: string }[] | null;
    qr_tokens:
      | { display_code: string; status: string; issued_at: string }[]
      | { display_code: string; status: string; issued_at: string }
      | null;
  };
  const rows = (data as Row[] | null) ?? [];
  const ids = rows.map((row) => row.id);
  const paidIds = new Set<string>();
  if (ids.length) {
    const { data: links } = await supabase
      .from("payment_participants")
      .select("registration_id, payments (status)")
      .in("registration_id", ids);
    type Link = {
      registration_id: string | null;
      payments: { status: string } | { status: string }[] | null;
    };
    for (const link of (links as Link[] | null) ?? []) {
      if (!link.registration_id) continue;
      const pay = link.payments;
      const statuses = pay ? (Array.isArray(pay) ? pay.map((item) => item.status) : [pay.status]) : [];
      if (statuses.some((status) => status === "VERIFIED" || status === "UNDER_REVIEW")) {
        paidIds.add(link.registration_id);
      }
    }
  }
  return rows.map((row) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const committee = Array.isArray(row.committees) ? row.committees[0] : row.committees;
    const collective = Array.isArray(row.collectives) ? row.collectives[0] : row.collectives;
    const institution = Array.isArray(row.institutions) ? row.institutions[0] : row.institutions;
    const tokens = Array.isArray(row.qr_tokens) ? row.qr_tokens : row.qr_tokens ? [row.qr_tokens] : [];
    const active = tokens.find((item) => item.status === "ACTIVE") ?? null;
    const paid =
      (row.status === "CONFIRMED" && !row.confirmed_free) ||
      row.status === "PAYMENT_VERIFIED" ||
      paidIds.has(row.id);
    return {
      id: row.id,
      edition_id: row.edition_id,
      user_id: row.user_id,
      full_name: user?.full_name ?? "Delegate",
      email: user?.email ?? "",
      status: row.status,
      committee_short_name: committee?.short_name ?? null,
      food_preference: row.food_preference,
      paid,
      confirmed_free: row.confirmed_free,
      collective_name: collective?.name ?? null,
      institution_name: institution?.name ?? null,
      delegation_type: row.delegation_type ?? "SINGLE",
      partner_email: row.partner_email,
      allocated_slr: row.allocated_slr,
      allocated_portfolio: row.allocated_portfolio,
      display_code: active?.display_code ?? null,
    };
  });
}

export async function getAdminParticipant(
  registrationId: string,
): Promise<AdminParticipant | null> {
  const rows = await getAdminParticipants();
  return rows.find((row) => row.id === registrationId) ?? null;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const supabase = await createClient();
  const [{ data: users }, { data: roleRows }, { data: registrations }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, full_name, phone, email_verified_at, status, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("user_roles").select("user_id"),
    supabase
      .from("registrations")
      .select("id, user_id, status, submitted_at, committees:committee_id (short_name)")
      .is("deleted_at", null)
      .neq("status", "CANCELLED"),
  ]);

  const staffIds = new Set(
    ((roleRows ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
  );

  type RegRow = {
    id: string;
    user_id: string;
    status: AdminUser["registration_status"];
    submitted_at: string | null;
    committees: { short_name: string } | { short_name: string }[] | null;
  };
  const registrationByUser = new Map<
    string,
    {
      registration_id: string;
      status: AdminUser["registration_status"];
      committee_short_name: string | null;
      submitted: number;
    }
  >();
  for (const row of (registrations as RegRow[] | null) ?? []) {
    const committee = Array.isArray(row.committees) ? row.committees[0] : row.committees;
    const submitted = row.submitted_at ? Date.parse(row.submitted_at) : 0;
    const current = registrationByUser.get(row.user_id);
    if (!current || submitted >= current.submitted) {
      registrationByUser.set(row.user_id, {
        registration_id: row.id,
        status: row.status,
        committee_short_name: committee?.short_name ?? null,
        submitted,
      });
    }
  }

  type UserRow = {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    email_verified_at: string | null;
    status: AdminUser["status"];
    created_at: string;
  };

  return ((users as UserRow[] | null) ?? [])
    .filter((row) => !staffIds.has(row.id))
    .map((row) => {
      const registration = registrationByUser.get(row.id);
      return {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        phone: row.phone,
        email_verified_at: row.email_verified_at,
        status: row.status,
        created_at: row.created_at,
        registration_id: registration?.registration_id ?? null,
        registration_status: registration?.status ?? null,
        committee_short_name: registration?.committee_short_name ?? null,
      };
    });
}

export async function getAdminUser(userId: string): Promise<AdminUser | null> {
  const rows = await getAdminUsers();
  return rows.find((row) => row.id === userId) ?? null;
}

export async function getFoodCollections(
  editionId: string,
  eventDay: number,
): Promise<FoodCollectionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("food_distribution")
    .select(
      `id, collected_at, meal_schedule_id,
       meal_schedules!inner (event_day, edition_id, meal_types (name)),
       registrations!inner (
         users:user_id (full_name, email),
         committees:committee_id (short_name)
       )`,
    )
    .order("collected_at", { ascending: false });
  type Row = {
    id: string;
    collected_at: string;
    meal_schedule_id: string;
    meal_schedules:
      | {
          event_day: number;
          edition_id: string;
          meal_types: { name: string } | { name: string }[] | null;
        }
      | {
          event_day: number;
          edition_id: string;
          meal_types: { name: string } | { name: string }[] | null;
        }[]
      | null;
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
  return ((data as Row[] | null) ?? [])
    .map((row) => {
      const schedule = Array.isArray(row.meal_schedules) ? row.meal_schedules[0] : row.meal_schedules;
      const meal = schedule
        ? Array.isArray(schedule.meal_types)
          ? schedule.meal_types[0]
          : schedule.meal_types
        : null;
      const registration = Array.isArray(row.registrations) ? row.registrations[0] : row.registrations;
      const user = registration
        ? Array.isArray(registration.users)
          ? registration.users[0]
          : registration.users
        : null;
      const committee = registration
        ? Array.isArray(registration.committees)
          ? registration.committees[0]
          : registration.committees
        : null;
      return {
        id: row.id,
        meal_schedule_id: row.meal_schedule_id,
        event_day: schedule?.event_day ?? eventDay,
        edition_id: schedule && "edition_id" in schedule ? schedule.edition_id : "",
        meal_name: meal?.name ?? "Meal",
        full_name: user?.full_name ?? "Delegate",
        email: user?.email ?? "",
        committee_short_name: committee?.short_name ?? null,
        collected_at: row.collected_at,
      };
    })
    .filter(
      (row) =>
        isConferenceMeal(row.meal_name) &&
        row.event_day === eventDay &&
        row.edition_id === editionId,
    );
}

export async function getConferenceDocuments(): Promise<ConferenceDocument[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conference_documents")
    .select("kind, file_name, storage_key, uploaded_by, created_at, updated_at");
  return (data as ConferenceDocument[]) ?? [];
}

export async function getConferenceDocument(
  kind: ConferenceDocument["kind"],
): Promise<ConferenceDocument | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conference_documents")
    .select("kind, file_name, storage_key, uploaded_by, created_at, updated_at")
    .eq("kind", kind)
    .maybeSingle();
  return (data as ConferenceDocument | null) ?? null;
}

export async function getCollectives(): Promise<Collective[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("collectives")
    .select("id, name, created_at, updated_at")
    .order("name", { ascending: true });
  return (data as Collective[]) ?? [];
}

export async function getInstitutions(): Promise<Institution[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("institutions")
    .select("id, name, created_at, updated_at")
    .order("name", { ascending: true });
  return (data as Institution[]) ?? [];
}

export async function getRegistrationPhases(editionId: string): Promise<RegistrationPhase[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("registration_phases")
    .select("id, edition_id, kind, is_active")
    .eq("edition_id", editionId)
    .order("kind", { ascending: true });
  const order = { EARLY_BIRD: 0, PHASE_1: 1, PHASE_2: 2 };
  return ((data as RegistrationPhase[] | null) ?? []).sort(
    (a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9),
  );
}

export async function getCommitteeFeeRows(committeeId: string): Promise<CommitteePhaseFee[]> {
  const supabase = await createClient();
  const { data: feeData } = await supabase
    .from("committee_phase_fees")
    .select("id, committee_id, phase_id, single_fee_minor, double_fee_minor")
    .eq("committee_id", committeeId);
  const rows = (feeData as CommitteePhaseFee[] | null) ?? [];
  if (!rows.length) return [];
  const { data: phases } = await supabase
    .from("registration_phases")
    .select("id, kind")
    .in(
      "id",
      rows.map((row) => row.phase_id),
    );
  const kindById = new Map(
    ((phases as Array<{ id: string; kind: CommitteePhaseFee["kind"] }> | null) ?? []).map((phase) => [
      phase.id,
      phase.kind,
    ]),
  );
  return rows.map((row) => ({ ...row, kind: kindById.get(row.phase_id) }));
}

export async function getEditionExpenses(editionId: string): Promise<EditionExpense[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("edition_expenses")
    .select("id, edition_id, title, category, amount_minor, incurred_on, notes, created_at")
    .eq("edition_id", editionId)
    .order("incurred_on", { ascending: false });
  return (data as EditionExpense[]) ?? [];
}

export async function getEditionExpenseTotal(editionId: string): Promise<number> {
  const rows = await getEditionExpenses(editionId);
  return rows.reduce((sum, row) => sum + (row.amount_minor ?? 0), 0);
}
