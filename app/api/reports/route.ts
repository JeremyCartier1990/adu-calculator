import { after } from "next/server";
import { addressIdentity } from "@/lib/address";
import { emailDomainAcceptsMail } from "@/lib/email-check";
import { validateLead } from "@/lib/lead";
import { clientIp, RATE_LIMITS, takeToken } from "@/lib/rate-limit";
import { parseConfirmedProperty } from "@/lib/report";
import { enableSharedPropertyReachCache } from "@/lib/propertyreach-cache";
import { attachFinancials, createReport, findReportByPhone, reissueEditKey, StoreNotConfiguredError } from "@/lib/report-store";
import { recordSubmission, type Submission } from "@/lib/submissions";
import { verificationConfigured, verifiedPhoneFromRequest } from "@/lib/verify-cookie";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 200) : null);

/** Lead capture: contact details plus the confirmed property start a saved report. Every submission is logged. */
export async function POST(request: Request): Promise<Response> {
  enableSharedPropertyReachCache();
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
  const log = (entry: Partial<Submission> & Pick<Submission, "outcome">) =>
    after(() =>
      recordSubmission({
        name: text(body.name),
        email: text(body.email),
        phone: text(body.phone),
        address: property?.address ?? text((body.property as { address?: unknown } | undefined)?.address),
        detail: property ? { property } : null,
        ...entry,
      }),
    );
  if (!property) {
    log({ outcome: "invalid", detail: { reason: "property" } });
    return json({ ok: false, code: "invalid", message: "Confirm the property address first.", errors: {} }, 400);
  }
  const lead = validateLead({ ...body, address: property.address });
  if (!lead.ok) {
    log({ outcome: "invalid", detail: { reason: "fields", errors: lead.errors, property } });
    return json({ ok: false, code: "invalid", message: "Check the highlighted fields.", errors: lead.errors }, 400);
  }
  if (lead.dropped) {
    log({ outcome: "invalid", detail: { reason: "honeypot" } });
    console.info(JSON.stringify({ event: "report_dropped", reason: "honeypot" }));
    return json({ ok: false, code: "invalid", message: "Check the highlighted fields.", errors: {} }, 400);
  }
  if (lead.lead.email && !(await emailDomainAcceptsMail(lead.lead.email))) {
    log({ outcome: "invalid", detail: { reason: "email_domain", property } });
    return json(
      { ok: false, code: "invalid", message: "Check the highlighted fields.", errors: { email: "That email domain can't receive mail." } },
      400,
    );
  }

  // When text verification is connected, the report requires the phone it verified.
  const verified = verifiedPhoneFromRequest(request);
  const phoneVerified = verified === lead.lead.phone;
  if (verificationConfigured() && !phoneVerified) {
    log({ outcome: "verification_required", phone: lead.lead.phone });
    return json({ ok: false, code: "verification_required", message: "Verify your phone number to open the report." }, 403);
  }

  const contact = { name: lead.lead.name, email: lead.lead.email, phone: lead.lead.phone };
  try {
    // One address per phone number. The same address reopens the report; another address is refused.
    const existing = await findReportByPhone(lead.lead.phone);
    if (existing) {
      if (phoneVerified && addressIdentity(existing.property.address) === addressIdentity(property.address)) {
        const editKey = await reissueEditKey(existing.id);
        log({ ...contact, outcome: "returning", reportId: existing.id });
        return json({ ok: true, id: existing.id, editKey });
      }
      log({ ...contact, outcome: "phone_used", reportId: existing.id });
      // Only a verified phone learns which address it was used for.
      const message = phoneVerified
        ? `This phone number already has a report for ${existing.property.address}. Each number can run one address.`
        : "This phone number already has a report for another address. Each number can run one address.";
      return json({ ok: false, code: "phone_used", message, errors: { phone: message } }, 409);
    }

    const { report, editKey } = await createReport({
      name: lead.lead.name,
      email: lead.lead.email,
      phone: lead.lead.phone,
      phoneVerified,
      property,
    });
    // One PropertyReach credit per lead, after the response so the homeowner never waits on it.
    after(() => attachFinancials(report));
    log({ ...contact, outcome: "created", reportId: report.id });
    // TODO(crm): forward new reports to the CRM or a team notification. The report URL is the handoff.
    console.info(JSON.stringify({ event: "report_created", id: report.id, phoneVerified, source: property.source }));
    return json({ ok: true, id: report.id, editKey });
  } catch (error) {
    if (error instanceof StoreNotConfiguredError) {
      log({ ...contact, outcome: "store_missing" });
      console.error(JSON.stringify({ event: "report_store_missing", lead: lead.lead }));
      return json({ ok: false, code: "not_configured", message: "Reports can't be saved right now. Your analysis is still below." }, 503);
    }
    throw error;
  }
}
