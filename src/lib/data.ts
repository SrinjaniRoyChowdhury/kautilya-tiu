import { createClient } from "@/lib/supabase/server";
import type {
  Announcement,
  Committee,
  Edition,
  Registration,
  RegistrationFieldDefinition,
  RegistrationFieldValue,
  SiteSettings,
  TeamMember,
} from "@/types";

const fallbackSettings: SiteSettings = {
  society_name: "Kautilya MUN",
  tagline: "Strategy. Diplomacy. Statecraft.",
  about_html: null,
  mission_html: null,
  history_html: null,
  contact_email: null,
  contact_phone: null,
  contact_address: null,
  instagram_url: null,
  linkedin_url: null,
  hero_stats: [],
};

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("site_settings").select("*").eq("id", true).maybeSingle();
    return (data as SiteSettings | null) ?? fallbackSettings;
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

export async function getCommitteesForEdition(editionId: string): Promise<Committee[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("committees")
    .select(
      "id, edition_id, name, short_name, slug, description, rules_url, capacity, confirmed_count, fee_minor, eb_json, portfolio_config, status, display_order",
    )
    .eq("edition_id", editionId)
    .is("deleted_at", null)
    .order("display_order", { ascending: true });
  return attachOccupancy(editionId, (data as Committee[]) ?? []);
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
    .select(
      "id, edition_id, name, short_name, slug, description, rules_url, capacity, confirmed_count, fee_minor, eb_json, portfolio_config, status, display_order",
    )
    .eq("edition_id", editionId)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const [committee] = await attachOccupancy(editionId, [data as Committee]);
  return committee ?? null;
}

export async function getAnnouncements(editionId?: string | null): Promise<Announcement[]> {
  const supabase = await createClient();
  let query = supabase
    .from("announcements")
    .select("id, edition_id, title, body_html, published_at")
    .eq("published", true)
    .order("display_order", { ascending: true });
  if (editionId) query = query.eq("edition_id", editionId);
  const { data } = await query;
  return (data as Announcement[]) ?? [];
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cms_team_members")
    .select("id, full_name, role_title, bio, photo_url, display_order")
    .eq("published", true)
    .order("display_order", { ascending: true });
  return (data as TeamMember[]) ?? [];
}

export async function getCommitteeById(id: string): Promise<Committee | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("committees")
    .select(
      "id, edition_id, name, short_name, slug, description, rules_url, capacity, confirmed_count, fee_minor, eb_json, portfolio_config, status, display_order",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as Committee | null) ?? null;
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
    .select(
      "id, edition_id, user_id, committee_id, status, food_preference, expected_fee_minor, submitted_at, confirmed_at",
    )
    .eq("edition_id", editionId)
    .eq("user_id", user.id)
    .neq("status", "CANCELLED")
    .is("deleted_at", null)
    .maybeSingle();
  return (data as Registration | null) ?? null;
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
