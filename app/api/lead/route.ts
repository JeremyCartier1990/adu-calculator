import { validateLead } from "@/lib/lead";
import { clientIp, RATE_LIMITS, takeToken } from "@/lib/rate-limit";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 20_000) {
    return json({ ok: false, code: "bad_request", message: "That request is too large." }, 413);
  }

  if (!takeToken("lead", clientIp(request), RATE_LIMITS.lead.limit, RATE_LIMITS.lead.windowMs)) {
    return json(
      { ok: false, code: "rate_limited", message: "Too many consultation requests. Please call us a little later." },
      429,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "bad_request", message: "Send the consultation form as JSON." }, 400);
  }

  const result = validateLead(body);
  if (!result.ok) {
    return json(
      {
        ok: false,
        code: "invalid",
        message: "Check the highlighted fields.",
        errors: result.errors,
      },
      400,
    );
  }

  if (result.dropped) {
    console.info(JSON.stringify({ event: "consultation_request_dropped", reason: "honeypot" }));
    return json({ ok: true });
  }

  // TODO(crm): Forward `lead` to the CRM (HubSpot, GoHighLevel, or the
  // Home First Remodel pipeline). Nothing is stored server-side yet — this
  // log is the handoff. Do not add secrets to the payload.
  console.info(
    JSON.stringify({
      event: "consultation_request",
      receivedAt: new Date().toISOString(),
      lead: result.lead,
    }),
  );

  return json({ ok: true });
}
