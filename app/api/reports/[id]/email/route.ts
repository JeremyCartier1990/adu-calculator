import { after } from "next/server";
import { emailDomainAcceptsMail } from "@/lib/email-check";
import { cleanEmail } from "@/lib/lead";
import { emailConfigured, sendReportEmail } from "@/lib/mailer";
import { clientIp, takeToken } from "@/lib/rate-limit";
import { pdfFileName, renderReportPdf } from "@/lib/report-pdf";
import { isReportId, saveReportEmail } from "@/lib/report-store";
import { recordSubmission } from "@/lib/submissions";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

/** The homeowner asks for the PDF by email: saves the address on the report and sends the PDF when email is connected. */
export async function POST(request: Request, { params }: RouteContext<"/api/reports/[id]/email">): Promise<Response> {
  const { id } = await params;
  const editKey = request.headers.get("x-edit-key") ?? "";
  if (!isReportId(id) || !editKey) return json({ ok: false, code: "not_found" }, 404);
  if (!takeToken("report-email", clientIp(request), 5, 60 * 60 * 1000)) {
    return json({ ok: false, code: "rate_limited", message: "Too many emails from this network. Try again later." }, 429);
  }

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return json({ ok: false, code: "bad_request" }, 400);
  }
  const email = typeof body.email === "string" ? cleanEmail(body.email) : null;
  if (!email) return json({ ok: false, code: "invalid", message: "Enter a valid email address." }, 400);
  if (!(await emailDomainAcceptsMail(email))) {
    return json({ ok: false, code: "invalid", message: "That email domain can't receive mail." }, 400);
  }

  const report = await saveReportEmail(id, editKey, email);
  if (report === "not_found") return json({ ok: false, code: "not_found" }, 404);
  if (report === "forbidden") return json({ ok: false, code: "forbidden" }, 403);
  after(() =>
    recordSubmission({ outcome: "pdf_email", reportId: id, name: report.name, email, phone: report.phone, address: report.property.address }),
  );

  if (!emailConfigured()) return json({ ok: true, sent: false });
  const sent = await sendReportEmail({
    to: email,
    name: report.name,
    address: report.property.address,
    reportUrl: `${new URL(request.url).origin}/r/${id}`,
    pdf: await renderReportPdf(report),
    fileName: pdfFileName(report),
  });
  return json({ ok: true, sent });
}
