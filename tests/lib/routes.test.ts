import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/routes";

describe("isPublicPath", () => {
  it.each(["/", "/privacy", "/login", "/no-access", "/auth/callback"])("allows %s", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(["/dashboard", "/settings", "/privacy/x", "/authors", "/maintainer"])("protects %s", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});
