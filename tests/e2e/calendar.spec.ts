import { expect, test } from "@playwright/test";
import { admin, createBatch, signInAs } from "./helpers";

/** Today in Berlin at the given local-looking UTC hour, so events land in the week the page opens on. */
function todayAt(hour: number) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  return `${day}T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

async function addCalendar(batchId: string, title: string, isCohort: boolean, events: object[]) {
  const { data, error } = await admin
    .from("calendars")
    .insert({ batch_id: batchId, title, is_cohort: isCohort, last_synced_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  const rows = events.map((event, index) => ({
    calendar_id: data.id,
    event_key: `e${index}`,
    uid: `e${index}`,
    starts_at: todayAt(9),
    ends_at: todayAt(10),
    ...event,
  }));
  const write = await admin.from("calendar_events").insert(rows);
  if (write.error) throw write.error;
}

test.describe("calendar", () => {
  test("cohort ticks stay saved, filters match the events, and details open with the meeting link", async ({ page, context }) => {
    const batch = await createBatch();
    await addCalendar(batch.id, "Kohorte 1", true, [{ title: "Daily" }, { title: "Lean Coffee", starts_at: todayAt(11), ends_at: todayAt(12) }]);
    await addCalendar(batch.id, "Kohorte 2", true, [{ title: "Daily", starts_at: todayAt(13), ends_at: todayAt(14) }]);
    await addCalendar(batch.id, "Sessions", false, [
      {
        title: "Foundations",
        starts_at: todayAt(16),
        ends_at: todayAt(19),
        location: "Online",
        description: "Trainer: Someone\nHandout: https://example.com/handout",
        meeting_url: "https://meet.google.com/abc-defg-hij",
      },
      { title: "Dropped session", starts_at: todayAt(5), ends_at: todayAt(6), cancelled_at: new Date().toISOString() },
    ]);
    const { id: userId } = await signInAs(context, batch.id);
    await page.goto("/calendar");

    // Cohorts start unticked, so only the shared calendar shows.
    await expect(page.getByRole("status").filter({ hasText: "Hake links deine Kohorte an" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Foundations/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Daily/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Dropped session.*Fällt aus/ })).toBeVisible();

    await page.getByRole("checkbox", { name: "Kohorte 1" }).click();
    await expect(page.getByRole("button", { name: /^Daily/ })).toHaveCount(1);
    await page.getByRole("checkbox", { name: "Lean Coffee" }).click();
    await expect(page.getByRole("button", { name: /^Lean Coffee/ })).toHaveCount(0);
    await page.getByRole("radio", { name: "Monat" }).or(page.getByRole("button", { name: "Monat" })).click();
    await expect(page.getByRole("button", { name: /^Daily/ })).toHaveCount(1);

    // A new visit brings back every choice as this person left it.
    await expect.poll(async () => {
      const { data } = await admin.from("calendar_preferences").select("view").eq("user_id", userId).maybeSingle();
      return data?.view;
    }).toBe("month");
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Kohorte 1" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Kohorte 2" })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Lean Coffee" })).not.toBeChecked();
    await expect(page.getByRole("button", { name: /^Lean Coffee/ })).toHaveCount(0);

    await page.getByRole("button", { name: /^Foundations/ }).click();
    const details = page.getByRole("dialog");
    await expect(details.getByRole("heading", { name: "Foundations" })).toBeVisible();
    await expect(details.getByRole("link", { name: "Meeting öffnen" })).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij");
    await expect(details.getByRole("link", { name: "https://example.com/handout" })).toBeVisible();
    await expect(details.getByText("Trainer: Someone")).toBeVisible();
  });

  test("another person's choices start fresh", async ({ page, context }) => {
    const batch = await createBatch();
    await addCalendar(batch.id, "Kohorte 1", true, [{ title: "Daily" }]);
    await signInAs(context, batch.id);
    await page.goto("/calendar");
    await expect(page.getByRole("checkbox", { name: "Kohorte 1" })).not.toBeChecked();
  });

  test("a batch without calendars says so", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/calendar");
    await expect(page.getByText("Noch keine Termine eingetragen.")).toBeVisible();
  });
});
