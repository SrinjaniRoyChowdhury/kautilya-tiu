import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url =
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    throw new Error("Missing SUPABASE_INTERNAL_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
