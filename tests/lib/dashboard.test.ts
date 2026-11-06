import { describe, expect, it } from "vitest";
import { filterItems, groupByTopic, moduleProgress, statusOf, type ItemView } from "@/lib/dashboard";

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

describe("statusOf", () => {
  it("treats an item without progress as new", () => {
    const progress = new Map([["a", "done" as const]]);
    expect(statusOf(progress, "a")).toBe("done");
    expect(statusOf(progress, "b")).toBe("new");
  });
});

describe("moduleProgress", () => {
  it("counts done and skipped as finished", () => {
    const result = moduleProgress([
      item("a", { status: "done" }),
      item("b", { status: "skipped" }),
      item("c", { status: "todo" }),
      item("d", { status: "new" }),
    ]);
    expect(result).toEqual({ finished: 2, total: 4, percent: 50, newCount: 1 });
  });

  it("handles an empty module", () => {
    expect(moduleProgress([])).toEqual({ finished: 0, total: 0, percent: 0, newCount: 0 });
  });
});

describe("filterItems", () => {
  const items = [
    item("a", { category: "recording", status: "new" }),
    item("b", { category: "session", status: "done" }),
    item("c", { category: "recording", status: "done" }),
  ];

  it("filters by category and status together", () => {
    expect(filterItems(items, { category: "recording", status: "done" }).map((i) => i.id)).toEqual(["c"]);
  });

  it("ignores missing or unknown filters", () => {
    expect(filterItems(items, {})).toHaveLength(3);
    expect(filterItems(items, { category: "nonsense", status: "nonsense" })).toHaveLength(3);
  });
});

describe("groupByTopic", () => {
  const topics = [
    { id: "t1", title: "Week 1" },
    { id: "t2", title: "Week 2" },
    { id: "t3", title: "Empty" },
  ];

  it("keeps topic order, drops empty topics, and puts items without a topic last", () => {
    const groups = groupByTopic(
      [item("a", { topic_id: "t2" }), item("b", { topic_id: "t1" }), item("c"), item("d", { topic_id: "gone" })],
      topics,
    );
    expect(groups.map((group) => [group.title, group.items.map((i) => i.id)])).toEqual([
      ["Week 1", ["b"]],
      ["Week 2", ["a"]],
      ["Weitere Einträge", ["c", "d"]],
    ]);
  });
});
