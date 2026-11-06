import { describe, expect, it } from "vitest";
import {
  displayTitle,
  dueItems,
  groupByModule,
  isStale,
  searchItems,
  splitLinks,
  type ItemView,
} from "@/lib/dashboard";
import { canDeleteAccount, parseLocale } from "@/lib/forms";
import { dictionaries } from "@/lib/i18n";

const item = (id: string, extra: Partial<ItemView> = {}): ItemView => ({
  id,
  note: null,
  favorite: false,
  module_id: "m1",
  topic_id: null,
  kind: "coursework",
  category: "session",
  title: id,
  description: null,
  classroom_url: null,
  posted_at: null,
  due_at: null,
  item_attachments: [],
  status: "new",
  ...extra,
});

describe("displayTitle", () => {
  it.each([
    ["🇬🇧 👨🏼‍💻 Mastering Git", "Mastering Git"],
    ["🔗 📑 🎙️ Additional material", "Additional material"],
    ['✅ Feedback "Git"', 'Feedback "Git"'],
    ["Plain title", "Plain title"],
    ["1. Numbered", "1. Numbered"],
    ["🇬🇧", "🇬🇧"],
  ])("cleans %j", (raw, expected) => {
    expect(displayTitle(raw)).toBe(expected);
  });
});

describe("isStale", () => {
  const now = new Date("2026-11-10T12:00:00Z");

  it("flags data older than 48 hours", () => {
    expect(isStale("2026-11-08T11:00:00Z", now)).toBe(true);
    expect(isStale("2026-11-08T13:00:00Z", now)).toBe(false);
  });

  it("does not warn before the first import", () => {
    expect(isStale(null, now)).toBe(false);
  });
});

describe("dueItems", () => {
  const now = new Date("2026-11-10T12:00:00Z");

  it("lists unfinished items due soon or already past, earliest first", () => {
    const result = dueItems(
      [
        item("later", { due_at: "2026-12-30T10:00:00Z" }),
        item("soon", { due_at: "2026-11-15T10:00:00Z", status: "todo" }),
        item("past", { due_at: "2026-11-01T10:00:00Z" }),
        item("finished", { due_at: "2026-11-12T10:00:00Z", status: "done" }),
        item("none"),
      ],
      now,
    );
    expect(result.map((entry) => [entry.id, entry.past])).toEqual([
      ["past", true],
      ["soon", false],
    ]);
  });
});

describe("groupByModule", () => {
  it("follows module order and drops empty modules", () => {
    const modules = [
      { id: "m0", title: "0. A" },
      { id: "m1", title: "1. B" },
      { id: "m2", title: "2. C" },
    ];
    const groups = groupByModule([item("x", { module_id: "m2" }), item("y", { module_id: "m0" })], modules);
    expect(groups.map((group) => [group.title, group.items.map((entry) => entry.id)])).toEqual([
      ["0. A", ["y"]],
      ["2. C", ["x"]],
    ]);
  });
});

describe("searchItems", () => {
  const items = [
    item("a", { title: "Mastering Git" }),
    item("b", { title: "Other", description: "All about GIT rebase" }),
    item("c", {
      title: "Third",
      item_attachments: [{ id: "1", type: "link", title: "Git handout", url: null }],
    }),
    item("d", { title: "Unrelated" }),
  ];

  it("matches titles, descriptions and attachments, ignoring case", () => {
    expect(searchItems(items, " git ").map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("needs at least two characters", () => {
    expect(searchItems(items, "g")).toEqual([]);
    expect(searchItems(items, "  ")).toEqual([]);
  });
});

describe("splitLinks", () => {
  it("splits text around web links and leaves trailing punctuation out", () => {
    expect(splitLinks("See https://example.com/a?b=1, then (http://x.io).")).toEqual([
      { text: "See " },
      { text: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { text: ", then (" },
      { text: "http://x.io", href: "http://x.io" },
      { text: ")." },
    ]);
  });

  it("never links other schemes", () => {
    expect(splitLinks("javascript:alert(1)")).toEqual([{ text: "javascript:alert(1)" }]);
  });
});

describe("parseLocale", () => {
  it("falls back to German", () => {
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("de")).toBe("de");
    expect(parseLocale("fr")).toBe("de");
    expect(parseLocale(undefined)).toBe("de");
  });
});

describe("canDeleteAccount", () => {
  it("protects a batch's last maintainer", () => {
    expect(canDeleteAccount("student", 0)).toBe(true);
    expect(canDeleteAccount("maintainer", 1)).toBe(true);
    expect(canDeleteAccount("maintainer", 0)).toBe(false);
  });
});

describe("dictionaries", () => {
  const keys = (value: object, prefix = ""): string[] =>
    Object.entries(value).flatMap(([key, entry]) =>
      typeof entry === "object" && entry !== null ? keys(entry, `${prefix}${key}.`) : [`${prefix}${key}`],
    );

  it("have the same keys in both languages", () => {
    expect(keys(dictionaries.en).sort()).toEqual(keys(dictionaries.de).sort());
  });
});
