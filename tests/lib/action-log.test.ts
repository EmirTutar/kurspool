import { describe, expect, it } from "vitest";
import { describeActionError } from "@/lib/action-log";

describe("describeActionError", () => {
  it("keeps the action, name, code and message", () => {
    const error = Object.assign(new Error("permission denied"), { code: "42501" });
    expect(describeActionError("setItemStatus", error)).toEqual({
      action: "setItemStatus",
      name: "Error",
      code: "42501",
      message: "permission denied",
    });
  });

  it("leaves out database details, which can contain personal data", () => {
    const error = { message: "duplicate key", code: "23505", details: "Key (email)=(someone@example.com) already exists.", hint: "x" };
    const logged = JSON.stringify(describeActionError("addAllowedEmail", error));
    expect(logged).not.toContain("someone@example.com");
    expect(logged).toContain("23505");
  });

  it("copes with something that is not an error", () => {
    expect(describeActionError("addTask", "oops")).toEqual({ action: "addTask", name: "unknown", code: undefined, message: undefined });
  });
});
