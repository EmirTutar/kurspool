import { describe, expect, it } from "vitest";
import { categorize, modulePosition, toAttachments, toDueAt, toItemRow } from "@/lib/sync/map";

describe("categorize", () => {
  it.each([
    ["📹 Recording: Kickoff", "recording"],
    ["✅ Feedback \"Git\"", "feedback"],
    ["🔗 📑 🎙️ Additional material/further reading", "reading"],
    ["🇬🇧 👨🏼‍💻 Mastering Git and GitHub", "session"],
    ["🇬🇧 Presentation & Exercise: Kickoff", "session"],
    ["📆 Evening live sessions", "organization"],
    ["🗓 Schedule", "organization"],
    ["📋 List of boards", "organization"],
    ["🎁 Wallpapers", "other"],
    ["Upload PDF file", "other"],
    ["", "other"],
  ])("sorts %j as %s", (title, category) => {
    expect(categorize(title)).toBe(category);
  });

  it("prefers a specific emoji over the flag", () => {
    expect(categorize("🇬🇧 📹 Recording of the session")).toBe("recording");
    expect(categorize("🇬🇧 ✅ Feedback")).toBe("feedback");
  });
});

describe("modulePosition", () => {
  it("reads the leading number", () => {
    expect(modulePosition("0. Start and Completion")).toBe(0);
    expect(modulePosition("12. Later")).toBe(12);
  });

  it("sorts names without a number last", () => {
    expect(modulePosition("Extras")).toBe(9999);
  });
});

describe("toDueAt", () => {
  it("combines date and time as UTC", () => {
    expect(toDueAt({ year: 2026, month: 11, day: 5 }, { hours: 22, minutes: 59 })).toBe("2026-11-05T22:59:00.000Z");
  });

  it("uses the end of the day without a time", () => {
    expect(toDueAt({ year: 2026, month: 11, day: 5 })).toBe("2026-11-05T23:59:00.000Z");
  });

  it("returns null without a date", () => {
    expect(toDueAt(undefined)).toBeNull();
  });
});

describe("toAttachments", () => {
  it("maps all four attachment types", () => {
    expect(
      toAttachments([
        { link: { url: "https://example.com/a", title: "A" } },
        { driveFile: { driveFile: { alternateLink: "https://drive.google.com/f", title: "F" } } },
        { youtubeVideo: { alternateLink: "https://youtu.be/v", title: "V" } },
        { form: { formUrl: "https://forms.gle/x", title: "X" } },
      ]),
    ).toEqual([
      { type: "link", url: "https://example.com/a", title: "A" },
      { type: "driveFile", url: "https://drive.google.com/f", title: "F" },
      { type: "youtubeVideo", url: "https://youtu.be/v", title: "V" },
      { type: "form", url: "https://forms.gle/x", title: "X" },
    ]);
  });

  it("drops unsafe links but keeps the attachment", () => {
    expect(toAttachments([{ link: { url: "javascript:alert(1)", title: "Bad" } }])).toEqual([
      { type: "link", url: null, title: "Bad" },
    ]);
  });

  it("ignores unknown types and missing materials", () => {
    expect(toAttachments([{ somethingNew: {} }])).toEqual([]);
    expect(toAttachments(undefined)).toEqual([]);
  });
});

describe("toItemRow", () => {
  const topics = new Map([["t1", "topic-uuid"]]);

  it("maps coursework without grades", () => {
    const row = toItemRow(
      "coursework",
      {
        id: "c1",
        title: "📹 Recording",
        description: "Text",
        alternateLink: "https://classroom.google.com/x",
        creationTime: "2026-10-30T10:00:00Z",
        updateTime: "2026-10-31T10:00:00Z",
        topicId: "t1",
        maxPoints: 100,
        dueDate: { year: 2026, month: 11, day: 5 },
      },
      topics,
    );
    expect(row).toEqual({
      classroom_id: "c1",
      kind: "coursework",
      category: "recording",
      title: "📹 Recording",
      description: "Text",
      classroom_url: "https://classroom.google.com/x",
      posted_at: "2026-10-30T10:00:00Z",
      classroom_updated_at: "2026-10-31T10:00:00Z",
      due_at: "2026-11-05T23:59:00.000Z",
      topic_id: "topic-uuid",
    });
    expect(row).not.toHaveProperty("maxPoints");
  });

  it("allows items without a topic or an unknown topic", () => {
    expect(toItemRow("material", { id: "m1", title: "x" }, topics).topic_id).toBeNull();
    expect(toItemRow("material", { id: "m2", title: "x", topicId: "gone" }, topics).topic_id).toBeNull();
  });

  it("uses the first line of an announcement as its title", () => {
    const row = toItemRow("announcement", { id: "a1", text: "📆 New date\nSee details below" }, topics);
    expect(row.title).toBe("📆 New date");
    expect(row.description).toBe("📆 New date\nSee details below");
    expect(row.category).toBe("organization");
  });

  it("drops an unsafe link back to Classroom", () => {
    expect(toItemRow("material", { id: "m3", title: "x", alternateLink: "javascript:x" }, topics).classroom_url).toBeNull();
  });
});
