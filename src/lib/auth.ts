import { createHash } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "blndfld_admin";

/**
 * The admin access key. When ADMIN_PASSWORD is set it is the only key that
 * works; the fallback below exists just for a fresh local checkout.
 */
export function getValidPasswords(): string[] {
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass) return [envPass];
  return ["Kashifmax11223344"];
}

export function isValidPassword(candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  const c = candidate.trim();
  return getValidPasswords().some((p) => p === c || p.toLowerCase() === c.toLowerCase());
}

/** Opaque session token handed to the browser after a successful login. */
export function generateAdminToken(): string {
  return createHash("sha256")
    .update(`blndfld::${getValidPasswords()[0]}::session::v4`)
    .digest("hex");
}

export function isValidToken(token: string | null | undefined): boolean {
  if (!token) return false;
  return token.trim() === generateAdminToken();
}

export function adminPassword(): string {
  return getValidPasswords()[0];
}

export function adminToken(): string {
  return generateAdminToken();
}

/**
 * Accepts the session in any of these places so the console keeps working
 * inside preview iframes where third-party cookies are blocked:
 *   1. Authorization: Bearer <token>   2. x-admin-token / x-admin-key
 *   3. ?token=...                       4. cookie
 */
export async function isAdmin(request?: Request): Promise<boolean> {
  if (request) {
    const header =
      request.headers.get("authorization") ||
      request.headers.get("x-admin-token") ||
      "";
    const bearer = header.replace(/^Bearer\s+/i, "").trim();
    if (bearer && (isValidToken(bearer) || isValidPassword(bearer))) return true;

    const key = request.headers.get("x-admin-key") || "";
    if (key && isValidPassword(key)) return true;

    try {
      const url = new URL(request.url);
      const q = url.searchParams.get("token") || url.searchParams.get("adminToken");
      if (q && (isValidToken(q) || isValidPassword(q))) return true;
    } catch {
      /* ignore malformed urls */
    }
  }

  try {
    const store = await cookies();
    const value = store.get(ADMIN_COOKIE)?.value;
    if (value && (isValidToken(value) || isValidPassword(value))) return true;
  } catch {
    /* cookies() unavailable in this context */
  }

  return false;
}
