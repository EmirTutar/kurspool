import { createClient } from "@/lib/supabase/server";

/** The signed-in user and their batch role, read through access rules. Null when either is missing. */
export async function getMembership() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("batch_members")
    .select("batch_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return null;

  return { supabase, user, batchId: member.batch_id as string, role: member.role as "student" | "maintainer" };
}
