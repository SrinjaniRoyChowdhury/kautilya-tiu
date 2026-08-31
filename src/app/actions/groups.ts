"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth";
import {
  getCollectiveDetail,
  getInstitutionDetail,
  type GroupDetail,
} from "@/lib/groups";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";

export type GroupActionState = {
  error?: string;
  success?: string;
};

const RPC_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sign in to continue.",
  FORBIDDEN: "You do not have permission for this action.",
  NOT_FOUND: "Not found.",
  NOT_REGISTERED: "That person has not submitted a registration yet.",
  NOT_ELIGIBLE: "Representatives must be registered and unpaid.",
  ALREADY_PAID: "That delegate already has a verified payment or confirmation.",
  INVALID_GROUP: "Invalid group.",
};

function rpcMessage(error: { message?: string } | null): string {
  const raw = (error?.message ?? "").toUpperCase();
  for (const [code, text] of Object.entries(RPC_MESSAGES)) {
    if (raw.includes(code)) return text;
  }
  return error?.message || "Something went wrong. Try again.";
}

function revalidateAll() {
  revalidatePath("/admin/collectives");
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/register");
  revalidatePath("/admin/participants");
}

export async function assignGroupMemberAction(
  registrationId: string,
  collectiveId: string | null,
  institutionId: string | null,
): Promise<GroupActionState> {
  if (!isUuid(registrationId)) return { error: "Missing registration." };
  const supabase = await createClient();

  if (collectiveId && isUuid(collectiveId)) {
    const { error } = await supabase.rpc("assign_registration_collective", {
      p_registration_id: registrationId,
      p_collective_id: collectiveId,
    });
    if (error) return { error: rpcMessage(error) };
  } else if (institutionId && isUuid(institutionId)) {
    const { error } = await supabase.rpc("assign_registration_institution", {
      p_registration_id: registrationId,
      p_institution_id: institutionId,
    });
    if (error) return { error: rpcMessage(error) };
  } else {
    return { error: "Missing group." };
  }

  revalidateAll();
  return { success: "Member added to the group." };
}

export async function removeGroupMemberAction(
  registrationId: string,
  kind: "collective" | "institution",
): Promise<GroupActionState> {
  if (!isUuid(registrationId)) return { error: "Missing registration." };
  const supabase = await createClient();
  const rpc =
    kind === "collective" ? "remove_registration_collective" : "remove_registration_institution";
  const { error } = await supabase.rpc(rpc, { p_registration_id: registrationId });
  if (error) return { error: rpcMessage(error) };
  revalidateAll();
  return { success: "Member removed from the group." };
}

export async function setGroupRepresentativeAction(
  userId: string,
  collectiveId: string | null,
  institutionId: string | null,
): Promise<GroupActionState> {
  if (!(await hasPermission("edition.manage"))) {
    return { error: "You cannot assign representatives." };
  }
  if (!isUuid(userId)) return { error: "Missing user." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_group_representative", {
    p_user_id: userId,
    p_collective_id: collectiveId,
    p_institution_id: institutionId,
  });
  if (error) return { error: rpcMessage(error) };
  revalidateAll();
  return { success: "Representative assigned." };
}

export async function clearGroupRepresentativeAction(
  collectiveId: string | null,
  institutionId: string | null,
): Promise<GroupActionState> {
  if (!(await hasPermission("edition.manage"))) {
    return { error: "You cannot change representatives." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_group_representative", {
    p_collective_id: collectiveId,
    p_institution_id: institutionId,
  });
  if (error) return { error: rpcMessage(error) };
  revalidateAll();
  return { success: "Representative removed." };
}

export async function loadGroupDetailAction(
  kind: "collective" | "institution",
  groupId: string,
  editionId: string,
): Promise<GroupDetail | null> {
  if (!isUuid(groupId) || !isUuid(editionId)) return null;
  const allowed =
    (await hasPermission("edition.manage")) ||
    (await getMyTeamAccessForGroup(kind, groupId));
  if (!allowed) return null;
  if (kind === "collective") return getCollectiveDetail(groupId, editionId);
  return getInstitutionDetail(groupId, editionId);
}

async function getMyTeamAccessForGroup(
  kind: "collective" | "institution",
  groupId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  let query = supabase.from("group_representatives").select("id").eq("user_id", user.id);
  if (kind === "collective") query = query.eq("collective_id", groupId);
  else query = query.eq("institution_id", groupId);
  const { data } = await query.maybeSingle();
  return Boolean(data);
}
