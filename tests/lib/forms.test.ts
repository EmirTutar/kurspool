import { describe, expect, it } from "vitest";
import { parseEmail, parseItemStatus, parseLink, parseTitle } from "@/lib/forms";

describe("parseLink", () => {
  it("accepts a labeled web link and trims it", () => {
    expect(parseLink("  Miro ", " https://miro.com/app/board/x ")).toEqual({ label: "Miro", url: "https://miro.com/app/board/x" });
  });

  it("adds https when the scheme is missing", () => {
    expect(parseLink("Miro", "miro.com/board")).toEqual({ label: "Miro", url: "https://miro.com/board" });
  });

  it.each([
    ["", "https://example.com"],
    ["Label", ""],
    ["Label", "javascript:alert(1)"],
    ["Label", "data:text/html,x"],
    ["Label", "ftp://example.com"],
    ["x".repeat(61), "https://example.com"],
    ["Label", `https://example.com/${"x".repeat(2100)}`],
  ])("rejects %j %j", (label, url) => {
    expect(parseLink(label, url)).toBeNull();
  });
});

describe("parseEmail", () => {
  it("normalizes valid addresses", () => {
    expect(parseEmail(" Name@Example.COM ")).toBe("name@example.com");
  });

  it.each(["", "no-at", "a@b", "a b@example.com"])("rejects %j", (value) => {
    expect(parseEmail(value)).toBeNull();
  });
});

describe("parseItemStatus", () => {
  it("allows only stored statuses", () => {
    expect(parseItemStatus("done")).toBe("done");
    expect(parseItemStatus("new")).toBeNull();
    expect(parseItemStatus(null)).toBeNull();
  });
});

describe("parseTitle", () => {
  it("trims and limits length", () => {
    expect(parseTitle("  Task ")).toBe("Task");
    expect(parseTitle("   ")).toBeNull();
    expect(parseTitle("x".repeat(201))).toBeNull();
  });
});
