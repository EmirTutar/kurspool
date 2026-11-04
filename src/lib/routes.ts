// /api/sync has no user session: it authorizes cron with its own secret.
const PUBLIC_PATHS = new Set(["/", "/privacy", "/login", "/no-access", "/api/sync"]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname === "/auth" || pathname.startsWith("/auth/");
}
