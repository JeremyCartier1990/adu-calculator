import { createHmac, timingSafeEqual } from "crypto";

export const VERIFY_COOKIE_NAME = "hfr_verified";
export const VERIFY_COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60;

type Ticket = { phone: string; exp: number };

function secret(): string | null {
  const value = process.env.VERIFY_COOKIE_SECRET?.trim();
  if (!value || value.length < 16) return null;
  return value;
}

export function verificationConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_VERIFY_SERVICE_SID?.trim() &&
      secret(),
  );
}

export function signVerifiedPhone(phone: string, key: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ phone, exp: now + VERIFY_COOKIE_MAX_AGE_SECONDS * 1000 } satisfies Ticket),
  ).toString("base64url");
  const signature = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readVerifiedPhone(token: string, key: string, now = Date.now()): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", key).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<Ticket>;
    if (typeof parsed.phone !== "string" || !parsed.phone.startsWith("+")) return null;
    if (typeof parsed.exp !== "number" || parsed.exp <= now) return null;
    return parsed.phone;
  } catch {
    return null;
  }
}

export function verifiedPhoneFromRequest(request: Request): string | null {
  const key = secret();
  if (!key) return null;
  const token = readCookie(request.headers.get("cookie"), VERIFY_COOKIE_NAME);
  if (!token) return null;
  return readVerifiedPhone(token, key);
}

export function verifiedCookieHeader(phone: string): string | null {
  const key = secret();
  if (!key) return null;
  const token = signVerifiedPhone(phone, key);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${VERIFY_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${VERIFY_COOKIE_MAX_AGE_SECONDS}${secure}`;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) return rest.join("=");
  }
  return null;
}
