import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/redirect";

describe("safeRedirectPath", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/modules/1?tab=new")).toBe("/modules/1?tab=new");
  });

  it.each([
    null,
    "",
    "dashboard",
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/\t/evil.example",
    "/\n/evil.example",
  ])("falls back to the dashboard for %j", (value) => {
    expect(safeRedirectPath(value)).toBe("/dashboard");
  });
});
