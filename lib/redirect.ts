const FALLBACK = "/dashboard";

/** Returns a same-site path, so a crafted login link cannot send users elsewhere. */
export function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/")) return FALLBACK;
  if (/[\\\u0000-\u001f]/.test(value) || value.startsWith("//")) return FALLBACK;
  return value;
}
