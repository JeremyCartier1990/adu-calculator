import { cookies } from "next/headers";
import { after } from "next/server";
import { hasTeamAccess } from "@/lib/admin-auth";
import { cleanEmail, cleanText } from "@/lib/lead";
import { normalizePhone } from "@/lib/phone";
import { enableSharedPropertyReachCache } from "@/lib/propertyreach-cache";
import { parseConfirmedProperty } from "@/lib/report";
import { attachFinancials, createReport, StoreNotConfiguredError } from "@/lib/report-store";
import { recordSubmission } from "@/lib/submissions";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

/**
 * Team builder: a signed-in team member starts a report without the lead form or
 * phone verification. Client details are optional; the report then works like any other.
 */
export async function POST(request: Request): Promise<Response> {
  if (!hasTeamAccess(await cookies())) return json({ ok: false, code: "unauthorized", message: "Sign in to the team builder." }, 401);
  enableSharedPropertyReachCache();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "bad_request", message: "Send the property as JSON." }, 400);
  }
  const property = parseConfirmedProperty(body.property, { californiaOnly: false });
  if (!property) return json({ ok: false, code: "invalid", message: "Confirm the property address first.", errors: {} }, 400);

  const errors: Record<string, string> = {};
  const name = typeof body.name === "string" ? cleanText(body.name, 80) : "";
  const phoneInput = typeof body.phone === "string" ? body.phone.trim() : "";
  const phone = phoneInput ? normalizePhone(phoneInput) : null;
  const emailInput = typeof body.email === "string" ? body.email.trim() : "";
  const email = emailInput ? cleanEmail(emailInput) : null;
  if (phoneInput && !phone) errors.phone = "Enter a 10-digit US phone number, or leave it empty.";
  if (emailInput && !email) errors.email = "Enter a valid email address, or leave it empty.";
  if (Object.keys(errors).length > 0) return json({ ok: false, code: "invalid", message: "Check the highlighted fields.", errors }, 400);

  try {
    const { report, editKey } = await createReport({
      name: name || "Team report",
      email,
      phone: phone ?? "",
      phoneVerified: false,
      property,
      createdBy: "team",
    });
    after(() => attachFinancials(report));
    after(() =>
      recordSubmission({ outcome: "team_created", reportId: report.id, name: report.name, email, phone, address: property.address }),
    );
    console.info(JSON.stringify({ event: "team_report_created", id: report.id }));
    return json({ ok: true, id: report.id, editKey });
  } catch (error) {
    if (error instanceof StoreNotConfiguredError) {
      return json({ ok: false, code: "not_configured", message: "Reports can't be saved right now. The analysis is still below." }, 503);
    }
    throw error;
  }
}
