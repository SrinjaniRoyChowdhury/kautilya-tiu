import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRoleRow } from "@/types";

export async function getSessionUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export async function getProfile(): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
    return (data as Profile | null) ?? null;
  } catch {
    return null;
  }
}

export async function getRoleNames(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("user_roles")
      .select("id, user_id, edition_id, roles(name)")
      .eq("user_id", user.id);
    const rows = (data ?? []) as UserRoleRow[];
    return rows.flatMap((row) => {
      const role = row.roles;
      if (!role) return [];
      return Array.isArray(role) ? role.map((r) => r.name) : [role.name];
    });
  } catch {
    return [];
  }
}

export async function isStaffUser(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data, error } = await supabase.rpc("is_staff");
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function hasPermission(code: string, editionId?: string | null): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data, error } = await supabase.rpc("has_permission", {
      p_code: code,
      p_edition_id: editionId ?? null,
    });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function hasScanAccess(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data, error } = await supabase.rpc("has_scan_access");
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

export function isOperatorOnly(roleNames: string[]): boolean {
  if (!roleNames.length) return false;
  return roleNames.every((name) => name === "ATTENDANCE_OPERATOR" || name === "FOOD_OPERATOR");
}
