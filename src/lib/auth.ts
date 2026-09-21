import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRoleRow } from "@/types";

/** One Auth round-trip per request (layout + admin + page all share this). */
export const getSessionUser = cache(async () => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  try {
    const user = await getSessionUser();
    if (!user) return null;
    const supabase = await createClient();
    const { data } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
    return (data as Profile | null) ?? null;
  } catch {
    return null;
  }
});

export const getRoleNames = cache(async (): Promise<string[]> => {
  try {
    const user = await getSessionUser();
    if (!user) return [];
    const supabase = await createClient();
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
});

export const isStaffUser = cache(async (): Promise<boolean> => {
  try {
    const user = await getSessionUser();
    if (!user) return false;
    // Roles already loaded for the shell — avoid a second is_staff RPC on every admin hop.
    const roles = await getRoleNames();
    if (roles.length > 0) return true;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("is_staff");
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
});

export const hasPermission = cache(async (code: string, editionId?: string | null): Promise<boolean> => {
  try {
    const user = await getSessionUser();
    if (!user) return false;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("has_permission", {
      p_code: code,
      p_edition_id: editionId ?? null,
    });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
});

export const hasScanAccess = cache(async (): Promise<boolean> => {
  try {
    const user = await getSessionUser();
    if (!user) return false;
    const roles = await getRoleNames();
    if (
      roles.some(
        (role) =>
          role === "SUPER_ADMIN" ||
          role === "ADMIN" ||
          role === "ATTENDANCE_OPERATOR" ||
          role === "FOOD_OPERATOR",
      )
    ) {
      return true;
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("has_scan_access");
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
});

export const PROTECTED_ADMIN_EMAILS = [
  "admin@kautilya.local",
  ...(process.env.PROTECTED_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
];

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

export {
  hasFullAdminRole,
  isContentEditorOnly,
  isDelegateAffairsOnly,
  isOperatorOnly,
  isViewerOnly,
} from "@/lib/roles";

export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const value = identifier.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("@")) return value;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("users").select("email").eq("username", value).maybeSingle();
    return (data as { email: string } | null)?.email ?? null;
  } catch {
    return null;
  }
}

export async function verifyAdminCredentials(
  identifier: string,
  password: string,
): Promise<{ success: true; user: { id: string; email?: string } } | { success: false; error: string }> {
  const email = await resolveLoginEmail(identifier);
  if (!email || !password?.trim()) {
    return { success: false, error: "Enter valid admin username/email and password." };
  }

  const url = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { success: false, error: "Authentication service unavailable." };
  }

  const authClient = createSupabaseClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { success: false, error: "Invalid admin username or password." };
  }

  const adminDb = createAdminClient();
  const { data: roles } = await adminDb
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", data.user.id);

  const roleRows = (roles ?? []) as UserRoleRow[];
  const roleNames = roleRows.flatMap((row) => {
    const r = row.roles;
    if (!r) return [];
    return Array.isArray(r) ? r.map((item) => item.name) : [r.name];
  });

  if (!roleNames.length) {
    return { success: false, error: "The provided account is not an authorized staff/admin account." };
  }

  return { success: true, user: { id: data.user.id, email: data.user.email } };
}

/** Like verifyAdminCredentials, but only SUPER_ADMIN credentials are accepted. */
export async function verifySuperAdminCredentials(
  identifier: string,
  password: string,
): Promise<{ success: true; user: { id: string; email?: string } } | { success: false; error: string }> {
  const result = await verifyAdminCredentials(identifier, password);
  if (!result.success) {
    if (result.error === "The provided account is not an authorized staff/admin account.") {
      return { success: false, error: "Enter a Super Admin username/email and password." };
    }
    return result;
  }

  const adminDb = createAdminClient();
  const { data: roles } = await adminDb
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", result.user.id);

  const roleRows = (roles ?? []) as UserRoleRow[];
  const roleNames = roleRows.flatMap((row) => {
    const r = row.roles;
    if (!r) return [];
    return Array.isArray(r) ? r.map((item) => item.name) : [r.name];
  });

  if (!roleNames.includes("SUPER_ADMIN")) {
    return {
      success: false,
      error: "Super Admin verification is required. Enter a Super Admin username and password.",
    };
  }

  return result;
}

export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  const roles = await getRoleNames();
  return roles.includes("SUPER_ADMIN");
}
