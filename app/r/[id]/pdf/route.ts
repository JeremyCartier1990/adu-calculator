import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { ReportPdf } from "@/lib/report-pdf";
import { getReport } from "@/lib/report-store";

export async function GET(_request: Request, { params }: RouteContext<"/r/[id]/pdf">): Promise<Response> {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return new Response("Report not found.", { status: 404 });

  const pdf = await renderToBuffer(createElement(ReportPdf, { report }) as Parameters<typeof renderToBuffer>[0]);
  const street = report.property.address.split(",")[0].replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ADU-ROI-Report-${street || "property"}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
