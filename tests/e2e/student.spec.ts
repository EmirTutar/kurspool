import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { admin, createBatch, signInAs } from "./helpers";

const showList = (page: Page) => page.getByRole("button", { name: "Listen-Ansicht" }).click();
const showCards = (page: Page) => page.getByRole("button", { name: "Kästchen-Ansicht" }).click();

test.describe("student", () => {
  test("sees new items, ticks one off, and progress goes up", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/dashboard");

    await expect(page.getByText("0 von 3 erledigt, 3 neu")).toBeVisible();
    await showList(page);
    await expect(page.getByRole("heading", { level: 2, name: "3 neue Einträge" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Slack" })).toBeVisible();
    // Leading emoji and flags are cleaned from titles.
    await expect(page.getByText("Git session", { exact: true })).toBeVisible();
    await expect(page.getByText("🇬🇧")).toHaveCount(0);

    await page.getByRole("checkbox", { name: "Als erledigt markieren: Recording" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "2 neue Einträge" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "2 neue Einträge" })).toBeVisible();
    await showCards(page);
    await expect(page.getByText("1 von 3 erledigt, 2 neu")).toBeVisible();
  });

  test("a tick that cannot reach the server stays on the page, reverts and says so", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/dashboard");
    await showList(page);

    const offline = (route: Route) => (route.request().method() === "POST" ? route.abort("failed") : route.continue());
    await page.route("**/dashboard*", offline);
    const box = page.getByRole("checkbox", { name: "Als erledigt markieren: Recording" });
    await box.click();

    await expect(page.getByText("Die Änderung wurde nicht gespeichert.")).toBeVisible();
    await expect(box).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("heading", { level: 2, name: "3 neue Einträge" })).toBeVisible();

    await page.unroute("**/dashboard*", offline);
    await box.click();
    await expect(page.getByRole("heading", { level: 2, name: "2 neue Einträge" })).toBeVisible();
  });

  test("opening an item keeps it readable, then moves it to Open, without overwriting Done", async ({ page, context }) => {
    const batch = await createBatch();
    const user = await signInAs(context, batch.id);
    await page.goto("/dashboard");
    await showList(page);

    await page.getByText("Git session", { exact: true }).click();
    const inlineLink = page.getByRole("link", { name: "https://example.com/guide" });
    await expect(inlineLink).toBeVisible();
    await expect(inlineLink).toHaveAttribute("href", "https://example.com/guide");
    await expect(page.getByRole("link", { name: "Handout" })).toBeVisible();

    await expect.poll(async () => {
      const { data } = await admin.from("item_progress").select("status").eq("user_id", user.id);
      return data?.map((row) => row.status);
    }).toEqual(["todo"]);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Offen (1)" })).toBeVisible();

    await page.getByRole("checkbox", { name: "Als erledigt markieren: Git session" }).click();
    await expect(page.getByRole("heading", { name: "Offen (0)" })).toBeVisible();
    await page.goto("/search?q=git");
    await page.getByText("Git session", { exact: true }).click();
    await page.waitForTimeout(500);
    const { data } = await admin.from("item_progress").select("status").eq("user_id", user.id);
    expect(data?.map((row) => row.status)).toEqual(["done"]);
  });

  test("marks everything as seen", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/dashboard");
    await showList(page);
    await page.getByRole("button", { name: "Alle als gesehen markieren" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Nichts Neues" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Offen (3)" })).toBeVisible();
  });

  test("adds a personal link, gets told about a bad one, and sees the button", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/settings");

    await page.getByLabel("Adresse").fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Link hinzufügen" }).click();
    await expect(page.getByText(/Der Link wurde nicht gespeichert/)).toBeVisible();

    await page.getByLabel("Adresse").fill("https://miro.com/app/board/test");
    await page.getByRole("button", { name: "Link hinzufügen" }).click();
    await expect(page.getByText("Der Link ist hinzugefügt.")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Kurslinks" }).getByRole("link", { name: "Mein Miro-Board" })).toBeVisible();
  });

  test("adds and completes a task", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/dashboard");

    await page.getByRole("textbox", { name: "Neue Aufgabe" }).fill("Read the handout");
    await page.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(page.getByText("Read the handout", { exact: true })).toBeVisible();
    const task = page.getByRole("checkbox", { name: "Read the handout erledigen" });
    await task.click();
    await expect(task).toBeChecked();
    await page.reload();
    await expect(task).toBeChecked();
  });

  test("filters a module and searches across items", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /First module/ }).click();
    await page.getByRole("link", { name: "Modul mit Filtern öffnen" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Week one" })).toBeVisible();

    await page.getByRole("link", { name: "Aufzeichnung" }).click();
    const week = page.getByRole("region", { name: "Week one" });
    await expect(week.getByText("Recording", { exact: true })).toBeVisible();
    await expect(week.getByText("Git session", { exact: true })).toHaveCount(0);

    await page.getByRole("searchbox").fill("handout");
    await page.getByRole("searchbox").press("Enter");
    await expect(page.getByText("1 Treffer für „handout“")).toBeVisible();
    await expect(page.getByRole("main").filter({ hasText: "Treffer" }).getByText("Git session", { exact: true })).toBeVisible();
  });

  test("shows deadlines carefully and warns about stale data", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await admin.from("batches").update({ last_synced_at: "2020-01-01T10:00:00Z" }).eq("id", batch.id);
    await page.goto("/dashboard");

    await expect(page.getByRole("alert").filter({ hasText: "möglicherweise veraltet" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Termine" })).toBeVisible();
    await expect(page.getByText(/Prüfe in Classroom, ob du schon abgegeben hast/)).toBeVisible();
  });

  test("switches to English and keeps the choice", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Your learning path" })).toBeVisible();
    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("switches to dark mode", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Farbmodus wechseln" }).click();
    const isDark = await page.locator("html").evaluate((node) => node.classList.contains("dark"));
    await page.getByRole("button", { name: "Farbmodus wechseln" }).click();
    expect(await page.locator("html").evaluate((node) => node.classList.contains("dark"))).toBe(!isDark);
  });

  test("shows the contact address only to accounts on a batch list", async ({ page, context }) => {
    const address = "contact@kurspool.test";
    await page.goto("/privacy");
    await expect(page.getByText("Emircan Tutar").first()).toBeVisible();
    await expect(page.getByText(/Kontaktadresse siehst du/).first()).toBeVisible();
    expect(await page.content()).not.toContain(address);

    const outsider = await signInAs(context, null);
    expect(outsider.email).toBeTruthy();
    await page.reload();
    await expect(page.getByText(/Kontaktadresse siehst du/).first()).toBeVisible();
    expect(await page.content()).not.toContain(address);

    await context.clearCookies();
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.reload();
    await expect(page.getByRole("link", { name: address })).toHaveAttribute("href", `mailto:${address}`);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Kontakt" })).toBeVisible();
  });

  test("stays inside the app on the privacy and home pages when signed in", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);

    await page.goto("/dashboard");
    await page.getByRole("contentinfo").getByRole("link", { name: "Datenschutz" }).click();
    await expect(page).toHaveURL("/privacy");
    await expect(page.getByRole("button", { name: "Abmelden" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Anmelden" })).toHaveCount(0);

    await page.getByRole("link", { name: "Zur Startseite" }).click();
    await expect(page).toHaveURL("/dashboard");
    await page.goto("/login");
    await expect(page).toHaveURL("/dashboard");
  });

  test("opens a module card and fills its progress circle", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/dashboard");

    const card = page.getByRole("button", { name: /First module/ });
    await expect(card).toHaveAttribute("aria-expanded", "false");
    await expect(card).toContainText("0%");
    await expect(page.getByRole("region", { name: "Week one" })).toHaveCount(0);

    await card.click();
    await expect(card).toHaveAttribute("aria-expanded", "true");
    const week = page.getByRole("region", { name: "Week one" });
    await expect(week.getByText("Recording", { exact: true })).toBeVisible();

    await week.getByRole("checkbox", { name: "Als erledigt markieren: Recording" }).click();
    await expect(card).toContainText("33%");
    await expect(card).toHaveAttribute("aria-expanded", "true");

    await card.click();
    await expect(page.getByRole("region", { name: "Week one" })).toHaveCount(0);
    await expect(page.getByText("Empty module")).toBeVisible();
    await expect(page.getByRole("button", { name: /Empty module/ })).toHaveCount(0);
  });

  test("keeps the module cards in place when one opens, on any screen", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);

    for (const size of [{ width: 1400, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/dashboard");
      const first = page.getByRole("button", { name: /First module/ });
      const empty = page.getByText("Empty module");
      const closed = await first.boundingBox();
      const closedEmpty = await empty.boundingBox();
      // Both cards share a row, so the grid is at least two wide even on a phone.
      expect(closedEmpty?.x ?? 0).toBeGreaterThan((closed?.x ?? 0) + (closed?.width ?? 0) - 1);

      await first.click();
      await expect(page.getByRole("region", { name: "Week one" })).toBeVisible();
      const opened = await first.boundingBox();
      expect(opened).toEqual(closed);
      expect(await empty.boundingBox()).toEqual(closedEmpty);

      await page.getByRole("button", { name: "Modul schließen" }).click();
      await expect(page.getByRole("region", { name: "Week one" })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    }
  });

  test("switches between the card and list views and remembers the choice", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/dashboard");

    await expect(page.getByRole("button", { name: /First module/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "3 neue Einträge" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Termine" })).toBeVisible();

    await showList(page);
    await expect(page.getByRole("heading", { name: "3 neue Einträge" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Offen (0)" })).toBeVisible();
    await expect(page.getByRole("button", { name: /First module/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Termine" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "3 neue Einträge" })).toBeVisible();
    await showCards(page);
    await expect(page.getByRole("button", { name: /First module/ })).toBeVisible();
  });

  test("shows a page-shaped placeholder while a page loads", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    // The placeholder comes with the prefetched page shell. A click before that keeps the old page until the server answers.
    const prefetched = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/dashboard" && url.searchParams.has("_rsc");
    });
    await page.goto("/settings");
    await prefetched;
    await page.waitForLoadState("networkidle");
    await page.route((url) => url.searchParams.has("_rsc"), async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue().catch(() => {});
    });
    await page.getByRole("link", { name: "Übersicht" }).click();
    await expect(page.locator(".loading-bone").first()).toBeVisible();
    await expect(page.getByText("…", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Dein Lernpfad" })).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".loading-bone")).toHaveCount(0);
  });

  test("opens and closes the sidebar and remembers it", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/dashboard");
    const sidebar = page.locator('[data-slot="sidebar"][data-state]');
    await expect(sidebar).toHaveAttribute("data-state", "expanded");

    await page.getByRole("button", { name: "Menü ein- oder ausklappen" }).click();
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    await page.reload();
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");

    await page.getByRole("button", { name: "Suchen" }).click();
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await expect(page.getByRole("searchbox")).toBeFocused();
  });

  test("opens the sidebar as a panel on a phone", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Einstellungen" })).toHaveCount(0);

    await page.getByRole("button", { name: "Menü ein- oder ausklappen" }).click();
    await page.getByRole("link", { name: "Einstellungen" }).click();
    await expect(page).toHaveURL("/settings");
    await expect(page.getByRole("link", { name: "Einstellungen" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  });

  test("links to the privacy page from the footer", async ({ page }) => {
    await page.goto("/login");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Kontakt" })).toHaveCount(0);
    await footer.getByRole("link", { name: "Datenschutz" }).click();
    await expect(page).toHaveURL("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Datenschutz" })).toBeVisible();
  });

  test("uses a true black background in dark mode", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/dashboard");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  });

  test("deletes the account only after confirming", async ({ page, context }) => {
    const batch = await createBatch();
    const user = await signInAs(context, batch.id);
    await page.goto("/settings");

    await page.getByLabel("Gib zur Bestätigung LÖSCHEN ein").fill("nein");
    await page.getByRole("button", { name: "Konto dauerhaft löschen" }).click();
    await expect(page.getByText(/Das Konto wurde nicht gelöscht/)).toBeVisible();
    expect((await admin.auth.admin.getUserById(user.id)).data.user).not.toBeNull();

    await page.getByLabel("Gib zur Bestätigung LÖSCHEN ein").fill("LÖSCHEN");
    await page.getByRole("button", { name: "Konto dauerhaft löschen" }).click();
    await expect(page).toHaveURL("/");
    expect((await admin.auth.admin.getUserById(user.id)).data.user).toBeNull();
  });
});

test.describe("access", () => {
  test("redirects visitors without a session to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
    await expect(page.getByRole("heading", { level: 1, name: "Bei Kurspool anmelden" })).toBeVisible();
  });

  test("sends an account that isn't on a batch list to the no-access page", async ({ page, context }) => {
    await signInAs(context, null);
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/no-access");
    await expect(page.getByRole("heading", { level: 1, name: "Kein Zugang" })).toBeVisible();

    await page.getByRole("button", { name: "Abmelden und anderes Konto wählen" }).click();
    await expect(page).toHaveURL("/");
    await page.getByRole("link", { name: "Anmelden" }).click();
    await expect(page).toHaveURL("/login");
  });

  test("keeps students off the maintainer page", async ({ page, context }) => {
    const batch = await createBatch();
    await signInAs(context, batch.id);
    await page.goto("/maintainer");
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByRole("link", { name: "Betreuung" })).toHaveCount(0);
  });
});

test.describe("maintainer", () => {
  test("manages course links and the batch list, and can't remove themselves", async ({ page, context }) => {
    const batch = await createBatch();
    const me = await signInAs(context, batch.id, "maintainer");
    await page.goto("/maintainer");

    await expect(page.getByText(me.email)).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`Entfernen.*${me.email}`) })).toHaveCount(0);

    await page.locator("#quick-label").fill("Wiki");
    await page.locator("#quick-url").fill("https://example.com/wiki");
    await page.getByRole("button", { name: "Link hinzufügen" }).click();
    await expect(page.getByRole("navigation", { name: "Kurslinks" }).getByRole("link", { name: "Wiki" })).toBeVisible();

    await page.locator("#allowed-email").fill("New.Student@example.com");
    await page.getByRole("button", { name: "Person freischalten" }).click();
    await expect(page.getByText("new.student@example.com", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Entfernen.*new.student@example.com/ }).click();
    await expect(page.getByText("new.student@example.com", { exact: true })).toHaveCount(0);
  });

  test("the last maintainer can't delete their account", async ({ page, context }) => {
    const batch = await createBatch();
    const me = await signInAs(context, batch.id, "maintainer");
    await page.goto("/settings");
    await page.getByLabel("Gib zur Bestätigung LÖSCHEN ein").fill("LÖSCHEN");
    await page.getByRole("button", { name: "Konto dauerhaft löschen" }).click();
    await expect(page.getByText(/Schalte zuerst eine weitere Person/)).toBeVisible();
    expect((await admin.auth.admin.getUserById(me.id)).data.user).not.toBeNull();
  });
});
