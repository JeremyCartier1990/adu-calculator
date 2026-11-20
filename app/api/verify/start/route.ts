import { addressIdentity } from "@/lib/address";
import { normalizePhone } from "@/lib/phone";
import { clientIp, RATE_LIMITS, takeToken } from "@/lib/rate-limit";
import { findReportByPhone } from "@/lib/report-store";
import { sendSmsCode } from "@/lib/twilio-verify";
import { verificationConfigured } from "@/lib/verify-cookie";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

const NOT_CONFIGURED =
  "Text verification isn't connected. The short-term figure stays a planning estimate.";

export async function POST(request: Request): Promise<Response> {
  if (!verificationConfigured()) {
    return json({ ok: false, code: "not_configured", message: NOT_CONFIGURED });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "bad_request", message: "Send a phone number." }, 400);
  }

  const phone = normalizePhone(typeof (body as { phone?: unknown }).phone === "string" ? (body as { phone: string }).phone : "");
  if (!phone) {
    return json({ ok: false, code: "invalid", message: "Enter a phone number with at least 10 digits." }, 400);
  }

  // Each phone gets one address; refuse before paying for a text that can't open a new report.
  const address = (body as { address?: unknown }).address;
  if (typeof address === "string" && address.trim()) {
    const existing = await findReportByPhone(phone).catch(() => null);
    if (existing && addressIdentity(existing.property.address) !== addressIdentity(address)) {
      return json(
        {
          ok: false,
          code: "phone_used",
          message: "This phone number already has a report for another address. Each number can run one address.",
        },
        409,
      );
    }
  }

  const ip = clientIp(request);
  if (!takeToken("verify-send-ip", ip, RATE_LIMITS.verifySendIp.limit, RATE_LIMITS.verifySendIp.windowMs)) {
    return json({ ok: false, code: "rate_limited", message: "Too many texts from this network. Try again later." }, 429);
  }
  if (!takeToken("verify-send-phone", phone, RATE_LIMITS.verifySendPhone.limit, RATE_LIMITS.verifySendPhone.windowMs)) {
    return json({ ok: false, code: "rate_limited", message: "Too many texts to that number. Try again later." }, 429);
  }

  const result = await sendSmsCode(phone);
  console.info(JSON.stringify({ event: "verify_send", ok: result.ok, status: result.ok ? result.status : result.status }));
  if (!result.ok) {
    return json({ ok: false, code: "upstream", message: "We couldn't send a text to that number." }, 502);
  }
  return json({ ok: true });
}
