const PUBLIC_PATHS = new Set(["/", "/privacy", "/login", "/no-access"]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname === "/auth" || pathname.startsWith("/auth/");
}
