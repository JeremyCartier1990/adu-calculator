import { pdfFileName, renderReportPdf } from "@/lib/report-pdf";
import { getReport } from "@/lib/report-store";

export async function GET(_request: Request, { params }: RouteContext<"/r/[id]/pdf">): Promise<Response> {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return new Response("Report not found.", { status: 404 });

  return new Response(await renderReportPdf(report), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFileName(report)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
