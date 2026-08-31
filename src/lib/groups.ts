import { createClient } from "@/lib/supabase/server";

export type GroupMember = {
  registration_id: string;
  user_id: string;
  full_name: string;
  email: string;
  status: string;
  committee_short_name: string | null;
};

export type GroupRepresentative = {
  user_id: string;
  full_name: string;
  email: string;
} | null;

export type GroupDetail = {
  id: string;
  name: string;
  kind: "collective" | "institution";
  representative: GroupRepresentative;
  members: GroupMember[];
};

export type MyTeamContext = {
  kind: "collective" | "institution";
  groupId: string;
  groupName: string;
  editionId: string;
  members: GroupMember[];
};

export async function getMyTeamContext(): Promise<MyTeamContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rep } = await supabase
    .from("group_representatives")
    .select(
      `id, collective_id, institution_id,
       collectives:collective_id (id, name),
       institutions:institution_id (id, name)`,
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!rep) return null;

  type RepRow = {
    collective_id: string | null;
    institution_id: string | null;
    collectives: { id: string; name: string } | { id: string; name: string }[] | null;
    institutions: { id: string; name: string } | { id: string; name: string }[] | null;
  };
  const row = rep as RepRow;
  const collective = Array.isArray(row.collectives) ? row.collectives[0] : row.collectives;
  const institution = Array.isArray(row.institutions) ? row.institutions[0] : row.institutions;

  const { data: edition } = await supabase
    .from("mun_editions")
    .select("id")
    .eq("is_public_active", true)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!edition?.id) return null;

  if (collective) {
    const members = await fetchGroupMembers(edition.id, collective.id, null);
    return {
      kind: "collective",
      groupId: collective.id,
      groupName: collective.name,
      editionId: edition.id,
      members,
    };
  }

  if (institution) {
    const members = await fetchGroupMembers(edition.id, null, institution.id);
    return {
      kind: "institution",
      groupId: institution.id,
      groupName: institution.name,
      editionId: edition.id,
      members,
    };
  }

  return null;
}

export async function fetchGroupMembers(
  editionId: string,
  collectiveId: string | null,
  institutionId: string | null,
): Promise<GroupMember[]> {
  const supabase = await createClient();
  let query = supabase
    .from("registrations")
    .select(
      `id, user_id, status,
       users:user_id (full_name, email),
       committees:committee_id (short_name)`,
    )
    .eq("edition_id", editionId)
    .is("deleted_at", null)
    .neq("status", "CANCELLED")
    .neq("status", "DRAFT")
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (collectiveId) query = query.eq("collective_id", collectiveId);
  if (institutionId) query = query.eq("institution_id", institutionId);

  const { data } = await query;
  type Row = {
    id: string;
    user_id: string;
    status: string;
    users: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
    committees: { short_name: string } | { short_name: string }[] | null;
  };

  return ((data as Row[] | null) ?? []).map((row) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const committee = Array.isArray(row.committees) ? row.committees[0] : row.committees;
    return {
      registration_id: row.id,
      user_id: row.user_id,
      full_name: user?.full_name ?? "Delegate",
      email: user?.email ?? "",
      status: row.status,
      committee_short_name: committee?.short_name ?? null,
    };
  });
}

export async function getCollectiveDetail(
  collectiveId: string,
  editionId: string,
): Promise<GroupDetail | null> {
  const supabase = await createClient();
  const { data: collective } = await supabase
    .from("collectives")
    .select("id, name")
    .eq("id", collectiveId)
    .maybeSingle();
  if (!collective) return null;

  const [members, representative] = await Promise.all([
    fetchGroupMembers(editionId, collectiveId, null),
    fetchRepresentative(collectiveId, null),
  ]);

  return {
    id: collective.id,
    name: collective.name,
    kind: "collective",
    representative,
    members,
  };
}

export async function getInstitutionDetail(
  institutionId: string,
  editionId: string,
): Promise<GroupDetail | null> {
  const supabase = await createClient();
  const { data: institution } = await supabase
    .from("institutions")
    .select("id, name")
    .eq("id", institutionId)
    .maybeSingle();
  if (!institution) return null;

  const [members, representative] = await Promise.all([
    fetchGroupMembers(editionId, null, institutionId),
    fetchRepresentative(null, institutionId),
  ]);

  return {
    id: institution.id,
    name: institution.name,
    kind: "institution",
    representative,
    members,
  };
}

async function fetchRepresentative(
  collectiveId: string | null,
  institutionId: string | null,
): Promise<GroupRepresentative> {
  const supabase = await createClient();
  let query = supabase
    .from("group_representatives")
    .select("user_id, users:user_id (full_name, email)");

  if (collectiveId) query = query.eq("collective_id", collectiveId);
  if (institutionId) query = query.eq("institution_id", institutionId);

  const { data } = await query.maybeSingle();
  if (!data) return null;

  type Row = {
    user_id: string;
    users: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
  };
  const row = data as Row;
  const user = Array.isArray(row.users) ? row.users[0] : row.users;
  if (!user) return null;
  return { user_id: row.user_id, full_name: user.full_name, email: user.email };
}
