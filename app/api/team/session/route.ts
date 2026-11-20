import { clearTeamCookieHeader, teamCodeMatches, teamConfigured, teamCookieHeader } from "@/lib/admin-auth";
import { clientIp, takeToken } from "@/lib/rate-limit";

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers });
}

/** Sign-in to the team report builder with the shared TEAM_ACCESS_CODE. */
export async function POST(request: Request): Promise<Response> {
  if (!teamConfigured()) {
    return json({ ok: false, message: "Set TEAM_ACCESS_CODE (8+ characters) to enable the team builder." }, 503);
  }
  if (!takeToken("team-login", clientIp(request), 10, 15 * 60 * 1000)) {
    return json({ ok: false, message: "Too many attempts. Wait 15 minutes." }, 429);
  }
  let body: { password?: unknown };
  try {
    body = (await request.json()) as { password?: unknown };
  } catch {
    return json({ ok: false, message: "Enter the access code." }, 400);
  }
  if (typeof body.password !== "string" || !teamCodeMatches(body.password)) {
    return json({ ok: false, message: "That access code isn't right." }, 401);
  }
  return json({ ok: true }, 200, { "Set-Cookie": teamCookieHeader() ?? "" });
}

export async function DELETE(): Promise<Response> {
  return json({ ok: true }, 200, { "Set-Cookie": clearTeamCookieHeader() });
}
