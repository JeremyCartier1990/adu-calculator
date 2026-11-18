import { normalizePhone } from "@/lib/phone";
import { clientIp, RATE_LIMITS, takeToken } from "@/lib/rate-limit";
import { checkSmsCode } from "@/lib/twilio-verify";
import { verificationConfigured, verifiedCookieHeader } from "@/lib/verify-cookie";

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers });
}

export async function POST(request: Request): Promise<Response> {
  if (!verificationConfigured()) {
    return json({
      ok: false,
      code: "not_configured",
      message: "Text verification isn't connected. The short-term figure stays a planning estimate.",
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "bad_request", message: "Send the phone number and code." }, 400);
  }

  const record = body as { phone?: unknown; code?: unknown };
  const phone = normalizePhone(typeof record.phone === "string" ? record.phone : "");
  const code = typeof record.code === "string" ? record.code.replace(/\D/g, "") : "";
  if (!phone) {
    return json({ ok: false, code: "invalid", message: "Enter the same phone number the text was sent to." }, 400);
  }
  if (code.length < 4 || code.length > 10) {
    return json({ ok: false, code: "invalid", message: "Enter the code from the text." }, 400);
  }

  const ip = clientIp(request);
  if (!takeToken("verify-check-ip", ip, RATE_LIMITS.verifyCheckIp.limit, RATE_LIMITS.verifyCheckIp.windowMs)) {
    return json({ ok: false, code: "rate_limited", message: "Too many code attempts. Try again later." }, 429);
  }
  if (!takeToken("verify-check-phone", phone, RATE_LIMITS.verifyCheckPhone.limit, RATE_LIMITS.verifyCheckPhone.windowMs)) {
    return json({ ok: false, code: "rate_limited", message: "Too many code attempts for that number." }, 429);
  }

  const result = await checkSmsCode(phone, code);
  console.info(JSON.stringify({ event: "verify_check", ok: result.ok, status: result.status }));
  if (!result.ok || result.status !== "approved") {
    return json({ ok: false, code: "invalid", message: "That code didn't match. Request a new text if it expired." }, 400);
  }

  const cookie = verifiedCookieHeader(phone);
  if (!cookie) {
    return json({ ok: false, code: "not_configured", message: "Verification can't be saved in this environment." }, 500);
  }
  return json({ ok: true, phone }, 200, { "Set-Cookie": cookie });
}
