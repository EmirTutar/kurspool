import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/routes";

describe("isPublicPath", () => {
  it.each(["/", "/privacy", "/login", "/no-access", "/auth/callback", "/api/sync"])("allows %s", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(["/dashboard", "/settings", "/privacy/x", "/authors", "/maintainer", "/api/classroom/connect", "/api/sync/x"])("protects %s", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});
