import { expect, test } from "@playwright/test";
import { createBatch, signInAs } from "./helpers";

// Exactly the confirmation: "Wird gespeichert …" contains the same word while a save is still running.
const SAVED = /^Gespeichert$/;

test.describe("notes", () => {
  test("a note on course material shows on the item and on the notes page, next to a note of one's own", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/search?q=Git");

    await page.getByRole("button", { name: /^Git session/ }).click();
    await page.getByRole("textbox", { name: "Meine Notiz" }).fill("Ask about rebase");
    await expect(page.getByRole("status").filter({ hasText: SAVED })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Mit Notiz")).toBeVisible();

    await page.getByRole("link", { name: "Notizen" }).click();
    await page.getByRole("textbox", { name: "Titel (optional)" }).fill("Ideas for the project");
    await page.getByRole("textbox", { name: "Notiz", exact: true }).fill("Use https://example.com/inspiration");
    await expect(page.getByRole("status").filter({ hasText: SAVED })).toBeVisible();
    await page.getByRole("button", { name: "Fertig" }).click();

    await expect(page.getByRole("tab", { name: "Alle (2)" })).toBeVisible();
    await page.getByRole("tab", { name: "Zu Kursmaterial (1)" }).click();
    const panel = page.getByRole("tabpanel", { name: "Zu Kursmaterial (1)" });
    await expect(panel.getByText("Ask about rebase")).toBeVisible();
    await expect(panel.getByText("Ideas for the project")).toHaveCount(0);
    await page.getByRole("tab", { name: "Eigene (1)" }).click();
    await expect(page.getByRole("tabpanel", { name: "Eigene (1)" }).getByRole("link", { name: "https://example.com/inspiration" })).toBeVisible();

    await page.getByRole("tab", { name: "Zu Kursmaterial (1)" }).click();
    await page.getByRole("link", { name: /Zum Kursmaterial/ }).click();
    await expect(page).toHaveURL(/\/modules\/.+#item-/);
    await expect(page.getByRole("heading", { level: 1, name: "0. First module" })).toBeVisible();
  });

  test("an emptied note on course material is removed", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/search?q=Git");
    await page.getByRole("button", { name: /^Git session/ }).click();
    const field = page.getByRole("textbox", { name: "Meine Notiz" });
    await field.fill("temporary");
    await expect(page.getByRole("status").filter({ hasText: SAVED })).toBeVisible();
    await field.fill("");
    await field.blur();
    await expect(page.getByRole("status").filter({ hasText: SAVED })).toBeVisible();
    await page.goto("/notes");
    await expect(page.getByRole("tab", { name: "Alle (0)" })).toBeVisible();
  });
});

test.describe("deleting notes", () => {
  test("asks in a dialog first, and cancelling keeps the note", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/notes");
    await page.getByRole("textbox", { name: "Titel (optional)" }).fill("Shopping list");
    await expect(page.getByRole("status").filter({ hasText: SAVED })).toBeVisible();
    await page.getByRole("button", { name: "Fertig" }).click();

    await expect(page.getByRole("button", { name: "Bearbeiten: Shopping list" })).toBeVisible();
    await page.getByRole("button", { name: "Löschen: Shopping list" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading", { name: "Notiz löschen?" })).toBeVisible();
    await expect(confirm.getByText("„Shopping list“ wird endgültig gelöscht.", { exact: false })).toBeVisible();
    await confirm.getByRole("button", { name: "Abbrechen" }).click();
    await expect(confirm).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Alle (1)" })).toBeVisible();

    await page.getByRole("button", { name: "Löschen: Shopping list" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await expect(page.getByText("Notiz gelöscht.")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Alle (0)" })).toBeVisible();
  });
});

test.describe("favorites and quick links", () => {
  test("stars course material and notes, lists them as favorites, and shows links without opening the item", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/search?q=Git");

    // The attachment is a button right on the row, before the item is opened.
    await expect(page.getByRole("link", { name: "Handout" })).toHaveAttribute("href", "https://example.com/handout");

    await page.getByRole("button", { name: "Als Favorit markieren: Git session" }).click();
    await expect(page.getByRole("button", { name: "Als Favorit markieren: Git session" })).toHaveAttribute("aria-pressed", "true");

    await page.goto("/notes");
    await page.getByRole("textbox", { name: "Notiz", exact: true }).fill("Starred thought");
    await expect(page.getByRole("status").filter({ hasText: SAVED })).toBeVisible();
    await page.getByRole("button", { name: "Fertig" }).click();
    await page.getByRole("button", { name: "Als Favorit markieren: Ohne Titel" }).click();
    await expect(page.getByRole("tab", { name: "Favoriten (1)" })).toBeVisible();

    await page.getByRole("link", { name: "Favoriten" }).click();
    await page.waitForURL(/\/favorites$/);
    await expect(page.getByRole("heading", { level: 1, name: "Favoriten" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Kursmaterial" }).getByRole("button", { name: /^Git session/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Notizen" }).getByText("Starred thought")).toBeVisible();
    await expect(page.getByText("Recording")).toHaveCount(0);
  });

  test("keeps an idea draft in the browser until it is shared", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/ideas");
    await page.getByRole("textbox", { name: "Deine Idee" }).fill("Half a thought");
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Deine Idee" })).toHaveValue("Half a thought");
    await expect(page.getByText("Noch keine Ideen. Schreib die erste.")).toBeVisible();
    await page.getByRole("button", { name: "Idee teilen" }).click();
    await expect(page.getByText("Idee geteilt.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Deine Idee" })).toHaveValue("");
  });
});

test.describe("ideas", () => {
  test("everyone in the batch sees shared ideas, and only the author can remove theirs", async ({ page, context, browser }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Ideen" }).click();
    await expect(page.getByText("Noch keine Ideen. Schreib die erste.")).toBeVisible();
    await page.getByRole("textbox", { name: "Deine Idee" }).fill("A dark mode for the calendar");
    await page.getByRole("button", { name: "Idee teilen" }).click();
    await expect(page.getByText("Idee geteilt.")).toBeVisible();
    await expect(page.getByText("Von dir")).toBeVisible();

    const other = await browser.newContext({ baseURL: "http://localhost:3100" });
    try {
      await signInAs(other, batch.id);
      const otherPage = await other.newPage();
      await otherPage.goto("/ideas");
      await expect(otherPage.getByText("A dark mode for the calendar")).toBeVisible();
      await expect(otherPage.getByText("Von dir")).toHaveCount(0);
      await expect(otherPage.getByRole("button", { name: /löschen/ })).toHaveCount(0);
    } finally {
      await other.close();
    }

    await page.getByRole("button", { name: /^Idee vom .* löschen$/ }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading", { name: "Idee löschen?" })).toBeVisible();
    await confirm.getByRole("button", { name: "Löschen" }).click();
    await expect(page.getByText("Idee gelöscht.")).toBeVisible();
    await expect(page.getByText("A dark mode for the calendar")).toHaveCount(0);
  });
});
