import { parsePropertyFacts, parseReportInputs } from "@/lib/report";
import { isReportId, saveReportInputs } from "@/lib/report-store";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

/** Saves the homeowner's calculator choices and any property facts they corrected. Only the browser that created the report holds the edit key. */
export async function PATCH(request: Request, { params }: RouteContext<"/api/reports/[id]">): Promise<Response> {
  const { id } = await params;
  const editKey = request.headers.get("x-edit-key") ?? "";
  if (!isReportId(id) || !editKey) return json({ ok: false, code: "not_found" }, 404);

  let body: { inputs?: unknown; property?: unknown };
  try {
    body = (await request.json()) as { inputs?: unknown; property?: unknown };
  } catch {
    return json({ ok: false, code: "bad_request" }, 400);
  }
  const inputs = parseReportInputs(body.inputs);
  if (!inputs) return json({ ok: false, code: "invalid", message: "Those calculator values are out of range." }, 400);

  const result = await saveReportInputs(id, editKey, inputs, parsePropertyFacts(body.property));
  if (result === "not_found") return json({ ok: false, code: "not_found" }, 404);
  if (result === "forbidden") return json({ ok: false, code: "forbidden" }, 403);
  return json({ ok: true });
}
