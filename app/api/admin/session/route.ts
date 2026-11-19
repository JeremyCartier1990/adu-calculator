import { adminConfigured, adminCookieHeader, clearAdminCookieHeader, passwordMatches } from "@/lib/admin-auth";
import { clientIp, takeToken } from "@/lib/rate-limit";

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers });
}

/** Team sign-in with the shared ADMIN_PASSWORD. */
export async function POST(request: Request): Promise<Response> {
  if (!adminConfigured()) {
    return json({ ok: false, message: "Set ADMIN_PASSWORD (10+ characters) to enable the team dashboard." }, 503);
  }
  if (!takeToken("admin-login", clientIp(request), 10, 15 * 60 * 1000)) {
    return json({ ok: false, message: "Too many attempts. Wait 15 minutes." }, 429);
  }
  let body: { password?: unknown };
  try {
    body = (await request.json()) as { password?: unknown };
  } catch {
    return json({ ok: false, message: "Enter the team password." }, 400);
  }
  if (typeof body.password !== "string" || !passwordMatches(body.password)) {
    return json({ ok: false, message: "That password isn't right." }, 401);
  }
  return json({ ok: true }, 200, { "Set-Cookie": adminCookieHeader() ?? "" });
}

export async function DELETE(): Promise<Response> {
  return json({ ok: true }, 200, { "Set-Cookie": clearAdminCookieHeader() });
}
