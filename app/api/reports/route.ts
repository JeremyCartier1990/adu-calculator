import { emailDomainAcceptsMail } from "@/lib/email-check";
import { validateLead } from "@/lib/lead";
import { clientIp, RATE_LIMITS, takeToken } from "@/lib/rate-limit";
import { parseConfirmedProperty } from "@/lib/report";
import { createReport, StoreNotConfiguredError } from "@/lib/report-store";
import { verificationConfigured, verifiedPhoneFromRequest } from "@/lib/verify-cookie";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

/** Lead capture: contact details plus the confirmed property start a saved report. */
export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 20_000) {
    return json({ ok: false, code: "bad_request", message: "That request is too large." }, 413);
  }
  if (!takeToken("lead", clientIp(request), RATE_LIMITS.lead.limit, RATE_LIMITS.lead.windowMs)) {
    return json({ ok: false, code: "rate_limited", message: "Too many reports from this network. Try again a little later." }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "bad_request", message: "Send your details as JSON." }, 400);
  }

  const property = parseConfirmedProperty(body.property);
  if (!property) {
    return json({ ok: false, code: "invalid", message: "Confirm the property address first.", errors: {} }, 400);
  }
  const lead = validateLead({ ...body, address: property.address });
  if (!lead.ok) {
    return json({ ok: false, code: "invalid", message: "Check the highlighted fields.", errors: lead.errors }, 400);
  }
  if (lead.dropped) {
    console.info(JSON.stringify({ event: "report_dropped", reason: "honeypot" }));
    return json({ ok: false, code: "invalid", message: "Check the highlighted fields.", errors: {} }, 400);
  }
  if (!(await emailDomainAcceptsMail(lead.lead.email))) {
    return json(
      { ok: false, code: "invalid", message: "Check the highlighted fields.", errors: { email: "That email domain can't receive mail." } },
      400,
    );
  }

  // When text verification is connected, the report requires the phone it verified.
  const verified = verifiedPhoneFromRequest(request);
  const phoneVerified = verified === lead.lead.phone;
  if (verificationConfigured() && !phoneVerified) {
    return json({ ok: false, code: "verification_required", message: "Verify your phone number to open the report." }, 403);
  }

  try {
    const { report, editKey } = await createReport({
      name: lead.lead.name,
      email: lead.lead.email,
      phone: lead.lead.phone,
      phoneVerified,
      property,
    });
    // TODO(crm): forward new reports to the CRM or a team notification. The report URL is the handoff.
    console.info(JSON.stringify({ event: "report_created", id: report.id, phoneVerified, source: property.source }));
    return json({ ok: true, id: report.id, editKey });
  } catch (error) {
    if (error instanceof StoreNotConfiguredError) {
      console.error(JSON.stringify({ event: "report_store_missing", lead: lead.lead }));
      return json({ ok: false, code: "not_configured", message: "Reports can't be saved right now. Your analysis is still below." }, 503);
    }
    throw error;
  }
}
