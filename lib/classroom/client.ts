import type { ClassroomItem } from "@/lib/sync/map";
import type { ClassroomCourse, ClassroomSource, ClassroomTopic } from "@/lib/sync/run";

const SCOPE_BASE = "https://www.googleapis.com/auth/classroom";
const API = "https://classroom.googleapis.com/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const SYNC_SCOPES = [
  `${SCOPE_BASE}.courses.readonly`,
  `${SCOPE_BASE}.coursework.me.readonly`,
  `${SCOPE_BASE}.courseworkmaterials.readonly`,
  `${SCOPE_BASE}.announcements.readonly`,
  `${SCOPE_BASE}.topics.readonly`,
];

type FetchLike = typeof fetch;

/** Google rejected the stored token, so the maintainer has to connect again. */
export class ReconnectRequiredError extends Error {
  constructor() {
    super("reconnect_required");
    this.name = "ReconnectRequiredError";
  }
}

export function buildAuthUrl({ clientId, redirectUri, state }: { clientId: string; redirectUri: string; state: string }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: SYNC_SCOPES.join(" "),
    state,
  }).toString();
  return url.toString();
}

async function requestToken(params: Record<string, string>, fetchImpl: FetchLike) {
  const response = await fetchImpl(TOKEN_URL, { method: "POST", body: new URLSearchParams(params) });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
  };
  if (body.error === "invalid_grant") throw new ReconnectRequiredError();
  if (!response.ok) throw new Error(`token_request_failed: ${response.status}`);
  return body;
}

export async function exchangeCode(
  config: { clientId: string; clientSecret: string; code: string; redirectUri: string },
  fetchImpl: FetchLike = fetch,
): Promise<string | undefined> {
  const body = await requestToken(
    {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: config.code,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    },
    fetchImpl,
  );
  return body.refresh_token;
}

export async function refreshAccessToken(
  config: { clientId: string; clientSecret: string; refreshToken: string },
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const body = await requestToken(
    {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    },
    fetchImpl,
  );
  if (!body.access_token) throw new Error("token_request_failed: no access token");
  return body.access_token;
}

/** Asks Google to end the app's access. Returns false instead of throwing, so disconnecting still clears local data. */
export async function revokeToken(token: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  try {
    const response = await fetchImpl("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      body: new URLSearchParams({ token }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function createClassroomSource(accessToken: string, fetchImpl: FetchLike = fetch): ClassroomSource {
  async function list<T>(path: string, key: string, query: Record<string, string> = {}): Promise<T[]> {
    const all: T[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(`${API}/${path}`);
      url.search = new URLSearchParams({ pageSize: "100", ...query, ...(pageToken ? { pageToken } : {}) }).toString();
      const response = await fetchImpl(url, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      if (!response.ok) throw new Error(`${path.split("/").pop()}: ${response.status}`);
      const page = (await response.json()) as Record<string, unknown> & { nextPageToken?: string };
      all.push(...((page[key] as T[] | undefined) ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return all;
  }

  return {
    listCourses: () => list<ClassroomCourse>("courses", "courses", { studentId: "me", courseStates: "ACTIVE" }),
    listTopics: (id) => list<ClassroomTopic>(`courses/${id}/topics`, "topic"),
    listCourseWork: (id) => list<ClassroomItem>(`courses/${id}/courseWork`, "courseWork"),
    listMaterials: (id) => list<ClassroomItem>(`courses/${id}/courseWorkMaterials`, "courseWorkMaterial"),
    listAnnouncements: (id) => list<ClassroomItem>(`courses/${id}/announcements`, "announcements"),
  };
}
