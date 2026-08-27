import { createAdminClient } from "@/lib/supabase/admin";
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

export const PROTECTED_ADMIN_EMAILS = ["admin@kautilya.local"];

export function isProtectedAdminEmail(email?: string | null): boolean {
  return Boolean(email && PROTECTED_ADMIN_EMAILS.includes(email.trim().toLowerCase()));
}

export async function isProtectedAdminAccount(userId: string, email?: string | null): Promise<boolean> {
  if (isProtectedAdminEmail(email)) return true;
  try {
    const admin = createAdminClient();
    const { data: user } = await admin.from("users").select("email").eq("id", userId).maybeSingle();
    if (isProtectedAdminEmail(user?.email)) return true;
    const { data } = await admin.from("user_roles").select("roles(name)").eq("user_id", userId);
    const rows = (data ?? []) as UserRoleRow[];
    return rows.some((row) => {
      const role = row.roles;
      const names = !role ? [] : Array.isArray(role) ? role.map((item) => item.name) : [role.name];
      return names.includes("SUPER_ADMIN");
    });
  } catch {
    return false;
  }
}

export function isOperatorOnly(roleNames: string[]): boolean {
  if (!roleNames.length) return false;
  return roleNames.every((name) => name === "ATTENDANCE_OPERATOR" || name === "FOOD_OPERATOR");
}

export function isContentEditorOnly(roleNames: string[]): boolean {
  return roleNames.length > 0 && roleNames.every((name) => name === "CONTENT_EDITOR");
}

export function isDelegateAffairsOnly(roleNames: string[]): boolean {
  return roleNames.length > 0 && roleNames.every((name) => name === "DELEGATE_AFFAIRS");
}

export function isViewerOnly(roleNames: string[]): boolean {
  return roleNames.length > 0 && roleNames.every((name) => name === "VIEWER");
}
