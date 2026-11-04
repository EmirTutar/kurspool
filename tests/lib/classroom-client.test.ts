import { describe, expect, it, vi } from "vitest";
import {
  buildAuthUrl,
  createClassroomSource,
  ReconnectRequiredError,
  refreshAccessToken,
  revokeToken,
  SYNC_SCOPES,
} from "@/lib/classroom/client";
import { isAuthorizedCron } from "@/lib/sync/cron-auth";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("buildAuthUrl", () => {
  it("requests offline access with read-only scopes", () => {
    const url = new URL(buildAuthUrl({ clientId: "id", redirectUri: "https://app/cb", state: "s" }));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("s");
    expect(url.searchParams.get("scope")).toBe(SYNC_SCOPES.join(" "));
    expect(SYNC_SCOPES.every((scope) => scope.endsWith(".readonly"))).toBe(true);
  });
});

describe("refreshAccessToken", () => {
  const config = { clientId: "id", clientSecret: "secret", refreshToken: "r" };

  it("returns the access token", async () => {
    const fetchImpl = vi.fn(async () => json({ access_token: "a" }));
    await expect(refreshAccessToken(config, fetchImpl)).resolves.toBe("a");
  });

  it("asks for a reconnect when Google rejects the token", async () => {
    const fetchImpl = vi.fn(async () => json({ error: "invalid_grant" }, 400));
    await expect(refreshAccessToken(config, fetchImpl)).rejects.toBeInstanceOf(ReconnectRequiredError);
  });

  it("reports other failures without leaking the token", async () => {
    const fetchImpl = vi.fn(async () => json({ error: "server_error" }, 500));
    const error = await refreshAccessToken(config, fetchImpl).catch((caught: Error) => caught);
    expect(error).not.toBeInstanceOf(ReconnectRequiredError);
    expect((error as Error).message).toContain("500");
    expect((error as Error).message).not.toContain("secret");
  });
});

describe("revokeToken", () => {
  it("posts the token to Google's revoke endpoint", async () => {
    const fetchImpl = vi.fn(async () => json({}));
    await expect(revokeToken("r", fetchImpl)).resolves.toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/revoke");
    expect(String(init.body)).toBe("token=r");
  });

  it("reports failure without throwing", async () => {
    await expect(revokeToken("r", vi.fn(async () => json({}, 400)))).resolves.toBe(false);
    await expect(revokeToken("r", vi.fn(async () => { throw new Error("offline"); }))).resolves.toBe(false);
  });
});

describe("createClassroomSource", () => {
  it("follows pagination and lists active student courses", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      return url.searchParams.get("pageToken")
        ? json({ courses: [{ id: "2" }] })
        : json({ courses: [{ id: "1" }], nextPageToken: "next" });
    });
    const courses = await createClassroomSource("token", fetchImpl).listCourses();
    expect(courses.map((course) => course.id)).toEqual(["1", "2"]);
    const first = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(first.searchParams.get("studentId")).toBe("me");
    expect(first.searchParams.get("courseStates")).toBe("ACTIVE");
  });

  it("reads each collection from the right response key", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/topics")) return json({ topic: [{ topicId: "t" }] });
      if (path.endsWith("/courseWork")) return json({ courseWork: [{ id: "w" }] });
      if (path.endsWith("/courseWorkMaterials")) return json({ courseWorkMaterial: [{ id: "m" }] });
      return json({ announcements: [{ id: "a" }] });
    });
    const source = createClassroomSource("token", fetchImpl);
    expect((await source.listTopics("c"))[0].topicId).toBe("t");
    expect((await source.listCourseWork("c"))[0].id).toBe("w");
    expect((await source.listMaterials("c"))[0].id).toBe("m");
    expect((await source.listAnnouncements("c"))[0].id).toBe("a");
  });

  it("treats a missing key as an empty list and an HTTP error as a failure", async () => {
    const empty = createClassroomSource("token", vi.fn(async () => json({})));
    await expect(empty.listCourseWork("c")).resolves.toEqual([]);
    const failing = createClassroomSource("token", vi.fn(async () => json({}, 403)));
    await expect(failing.listCourseWork("c")).rejects.toThrow("courseWork: 403");
  });
});

describe("isAuthorizedCron", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isAuthorizedCron("Bearer right-secret", "right-secret")).toBe(true);
    expect(isAuthorizedCron("Bearer wrong-secret", "right-secret")).toBe(false);
    expect(isAuthorizedCron("Bearer right-secret-longer", "right-secret")).toBe(false);
    expect(isAuthorizedCron(null, "right-secret")).toBe(false);
  });

  it("fails closed when no secret is configured", () => {
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
  });
});
