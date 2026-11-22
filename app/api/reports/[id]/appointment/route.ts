import { after } from "next/server";
import { parseAppointment } from "@/lib/appointment";
import { parseAttribution } from "@/lib/attribution";
import { sendAppointmentWebhook } from "@/lib/lead-webhook";
import { clientIp, RATE_LIMITS, takeToken } from "@/lib/rate-limit";
import { getReport, getReportForOwner, isReportId } from "@/lib/report-store";
import { recordSubmission } from "@/lib/submissions";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

/** The homeowner asks for an online meeting about their report. Logged with the lead, then sent to the team's webhook. */
export async function POST(request: Request, { params }: RouteContext<"/api/reports/[id]/appointment">): Promise<Response> {
  const { id } = await params;
  const editKey = request.headers.get("x-edit-key") ?? "";
  if (!isReportId(id)) return json({ ok: false, code: "not_found" }, 404);
  if (!takeToken("appointment", clientIp(request), RATE_LIMITS.appointment.limit, RATE_LIMITS.appointment.windowMs)) {
    return json({ ok: false, code: "rate_limited", message: "Too many requests. Try again a little later." }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "bad_request" }, 400);
  }
  const appointment = parseAppointment(body);
  if (!appointment) return json({ ok: false, code: "invalid", message: "Pick a day and a time." }, 400);

  // The owner sends the edit key; a shared link only has the report's private id, which is enough to ask for a meeting.
  const report = editKey ? await getReportForOwner(id, editKey) : ((await getReport(id)) ?? "not_found");
  if (report === "not_found") return json({ ok: false, code: "not_found" }, 404);
  if (report === "forbidden") return json({ ok: false, code: "forbidden" }, 403);

  const attribution = parseAttribution(body.attribution);
  after(() =>
    recordSubmission({
      outcome: "appointment",
      reportId: report.id,
      name: report.name,
      email: report.email,
      phone: report.phone,
      address: report.property.address,
      detail: { appointment, attribution },
    }),
  );
  after(() => sendAppointmentWebhook(report, appointment, attribution));
  return json({ ok: true });
}
