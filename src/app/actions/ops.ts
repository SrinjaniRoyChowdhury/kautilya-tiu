"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth";
import { QR_MESSAGES, rpcCode } from "@/lib/qr-http";
import { createClient } from "@/lib/supabase/server";

export type OpsState = {
  error?: string;
  success?: string;
};

function revalidateOps() {
  revalidatePath("/admin");
  revalidatePath("/admin/attendance");
  revalidatePath("/scan");
  revalidatePath("/dashboard");
}

export async function manualAttendanceAction(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  const allowed = await hasPermission("attendance.correct");
  if (!allowed) return { error: "You need attendance.correct to change records by hand." };
  const eventDay = Number(formData.get("event_day"));
  const reason = String(formData.get("reason") ?? "").trim();
  const mode = String(formData.get("mode") ?? "CHECK_IN");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter the delegate email." };
  if (reason.length < 3) return { error: QR_MESSAGES.REASON_REQUIRED };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!profile) return { error: "No account with that email." };
  const { data: registration } = await supabase
    .from("registrations")
    .select("id")
    .eq("user_id", profile.id)
    .eq("status", "CONFIRMED")
    .is("deleted_at", null)
    .maybeSingle();
  if (!registration) return { error: "That person is not confirmed." };

  const { error } = await supabase.rpc("manual_attendance", {
    p_registration_id: registration.id,
    p_event_day: eventDay,
    p_reason: reason,
    p_mode: mode,
  });
  if (error) {
    const code = rpcCode(error);
    return { error: QR_MESSAGES[code] ?? error.message };
  }
  revalidateOps();
  return { success: `Attendance ${mode.toLowerCase().replace("_", " ")} saved.` };
}

export async function addMealTypeAction(
  editionId: string,
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  const allowed = await hasPermission("edition.manage", editionId);
  if (!allowed) return { error: "You need edition.manage to change meals." };
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter a meal name." };
  const supabase = await createClient();
  const { data: meal, error } = await supabase
    .from("meal_types")
    .insert({ edition_id: editionId, name, display_order: 50 })
    .select("id")
    .maybeSingle();
  if (error || !meal) return { error: error?.message ?? "Could not add meal." };
  const { error: schedError } = await supabase.from("meal_schedules").insert(
    [1, 2, 3].map((day) => ({
      edition_id: editionId,
      event_day: day,
      meal_type_id: meal.id,
    })),
  );
  if (schedError) return { error: schedError.message };
  revalidatePath(`/admin/editions/${editionId}`);
  revalidatePath("/scan");
  revalidatePath("/admin/attendance");
  return { success: `${name} added for all three days.` };
}
