import "server-only";

import { createHash, createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE_NAME = "aduroi_admin";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

/** The team password. Sessions are signed with a key derived from it, so changing it signs everyone out. */
function password(): string | null {
  const value = process.env.ADMIN_PASSWORD?.trim();
  return value && value.length >= 10 ? value : null;
}

export function adminConfigured(): boolean {
  return password() != null;
}

function sessionKey(secret: string): Buffer {
  return createHash("sha256").update(`aduroi-admin-session:${secret}`).digest();
}

function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function passwordMatches(candidate: string): boolean {
  const secret = password();
  return secret != null && safeEqual(candidate, secret);
}

export function adminCookieHeader(now = Date.now()): string | null {
  const secret = password();
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_SECONDS * 1000 })).toString("base64url");
  const signature = createHmac("sha256", sessionKey(secret)).update(payload).digest("base64url");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_COOKIE_NAME}=${payload}.${signature}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearAdminCookieHeader(): string {
  return `${ADMIN_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function isAdminToken(token: string | undefined, now = Date.now()): boolean {
  const secret = password();
  if (!secret || !token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", sessionKey(secret)).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof exp === "number" && exp > now;
  } catch {
    return false;
  }
}
