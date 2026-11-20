import "server-only";

import { createHash, createHmac, timingSafeEqual } from "crypto";

// Two signed-cookie sessions share this code:
// - admin (ADMIN_PASSWORD): the leads dashboard, contact details and mortgage data;
// - team (TEAM_ACCESS_CODE): the private report builder, without the lead list.
// Each session is signed with a key derived from its secret, so changing it signs everyone out.

const SESSION_SECONDS = 7 * 24 * 60 * 60;

function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

function signedSession(cookieName: string, envVar: string, label: string, minLength: number) {
  const secret = (): string | null => {
    const value = process.env[envVar]?.trim();
    return value && value.length >= minLength ? value : null;
  };
  const sessionKey = (value: string) => createHash("sha256").update(`aduroi-${label}-session:${value}`).digest();

  return {
    cookieName,
    configured: () => secret() != null,
    matches(candidate: string): boolean {
      const value = secret();
      return value != null && safeEqual(candidate, value);
    },
    cookieHeader(now = Date.now()): string | null {
      const value = secret();
      if (!value) return null;
      const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_SECONDS * 1000 })).toString("base64url");
      const signature = createHmac("sha256", sessionKey(value)).update(payload).digest("base64url");
      const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
      return `${cookieName}=${payload}.${signature}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure}`;
    },
    clearCookieHeader: () => `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    isToken(token: string | undefined, now = Date.now()): boolean {
      const value = secret();
      if (!value || !token) return false;
      const [payload, signature] = token.split(".");
      if (!payload || !signature) return false;
      const expected = createHmac("sha256", sessionKey(value)).update(payload).digest("base64url");
      if (!safeEqual(signature, expected)) return false;
      try {
        const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
        return typeof exp === "number" && exp > now;
      } catch {
        return false;
      }
    },
  };
}

const admin = signedSession("aduroi_admin", "ADMIN_PASSWORD", "admin", 10);
// A shorter code reps can type; sign-in attempts are rate limited per network.
const team = signedSession("aduroi_team", "TEAM_ACCESS_CODE", "team", 8);

export const ADMIN_COOKIE_NAME = admin.cookieName;
export const adminConfigured = admin.configured;
export const passwordMatches = admin.matches;
export const adminCookieHeader = admin.cookieHeader;
export const clearAdminCookieHeader = admin.clearCookieHeader;
export const isAdminToken = admin.isToken;

export const TEAM_COOKIE_NAME = team.cookieName;
export const teamConfigured = team.configured;
export const teamCodeMatches = team.matches;
export const teamCookieHeader = team.cookieHeader;
export const clearTeamCookieHeader = team.clearCookieHeader;

/** Team builder access: a team session, or an admin session (admins can do everything the team can). */
export function hasTeamAccess(cookies: { get(name: string): { value: string } | undefined }): boolean {
  return team.isToken(cookies.get(TEAM_COOKIE_NAME)?.value) || admin.isToken(cookies.get(ADMIN_COOKIE_NAME)?.value);
}
