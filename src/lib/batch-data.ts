import { statusOf, type ItemView, type StoredStatus } from "@/lib/dashboard";
import { getMembership } from "@/lib/membership";

type Membership = NonNullable<Awaited<ReturnType<typeof getMembership>>>;

/** Loads everything a student sees. All reads go through access rules. */
export async function loadBatchData({ supabase, batchId, user }: Membership) {
  const [batch, modules, topics, items, progress] = await Promise.all([
    supabase.from("batches").select("name, last_synced_at").eq("id", batchId).single(),
    supabase.from("modules").select("id, title, position, classroom_url").order("position"),
    supabase.from("topics").select("id, module_id, title").order("title"),
    supabase
      .from("items")
      .select(
        "id, module_id, topic_id, kind, category, title, description, classroom_url, posted_at, due_at, item_attachments(id, type, title, url)",
      )
      .order("posted_at", { ascending: false, nullsFirst: false }),
    supabase.from("item_progress").select("item_id, status").eq("user_id", user.id),
  ]);

  const statuses = new Map((progress.data ?? []).map((row) => [row.item_id as string, row.status as StoredStatus]));
  const views = ((items.data ?? []) as unknown as Omit<ItemView, "status">[]).map((item) => ({
    ...item,
    status: statusOf(statuses, item.id),
  }));

  return {
    batch: batch.data as { name: string; last_synced_at: string | null } | null,
    modules: (modules.data ?? []) as { id: string; title: string; position: number; classroom_url: string | null }[],
    topics: (topics.data ?? []) as { id: string; module_id: string; title: string }[],
    items: views,
  };
}
