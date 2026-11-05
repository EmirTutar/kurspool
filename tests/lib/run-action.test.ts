import { describe, expect, it, vi } from "vitest";
import { chosenLocale, runAction } from "@/lib/run-action";

describe("runAction", () => {
  it("passes on what the action returns", async () => {
    await expect(runAction(async () => ({ ok: true, message: "Done" }))).resolves.toEqual({ ok: true, message: "Done" });
  });

  it("turns a request that never arrives into a failed result", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await runAction(async () => {
      throw new TypeError("Failed to fetch");
    });
    quiet.mockRestore();
    expect(result).toMatchObject({ ok: false });
    expect((result as { message: string }).message).toContain("nicht gespeichert");
  });

  it("lets a redirect from the server through", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/;307;" });
    await expect(
      runAction(async () => {
        throw redirect;
      }),
    ).rejects.toBe(redirect);
  });
});

describe("chosenLocale", () => {
  it("follows the language setting", () => {
    expect(chosenLocale("theme=dark; locale=de")).toBe("de");
    expect(chosenLocale("locale=en")).toBe("en");
  });

  it("falls back to English when no language was chosen", () => {
    expect(chosenLocale("")).toBe("en");
    expect(chosenLocale("mylocale=de")).toBe("en");
    expect(chosenLocale("locale=fr")).toBe("en");
  });
});
