import { clientIp, takeToken } from "@/lib/rate-limit";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

// Southern California first; suggestions elsewhere in the US still appear.
const SOCAL_BIAS = {
  rectangle: {
    low: { latitude: 32.5, longitude: -119.5 },
    high: { latitude: 34.9, longitude: -116.5 },
  },
};

/**
 * Address suggestions from Google Places Autocomplete (New). The key stays on
 * the server (GOOGLE_MAPS_API_KEY); without it the address field is plain text.
 */
export async function POST(request: Request): Promise<Response> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return json({ ok: false, code: "not_configured", suggestions: [] });

  let body: { input?: unknown; sessionToken?: unknown };
  try {
    body = (await request.json()) as { input?: unknown; sessionToken?: unknown };
  } catch {
    return json({ ok: false, code: "bad_request", suggestions: [] }, 400);
  }
  const input = typeof body.input === "string" ? body.input.trim().slice(0, 120) : "";
  const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken.slice(0, 64) : undefined;
  if (input.length < 3) return json({ ok: true, suggestions: [] });
  if (!takeToken("places", clientIp(request), 120, 60 * 60 * 1000)) {
    return json({ ok: false, code: "rate_limited", suggestions: [] }, 429);
  }

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "suggestions.placePrediction.text.text,suggestions.placePrediction.placeId",
    },
    body: JSON.stringify({
      input,
      sessionToken,
      includedRegionCodes: ["us"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
      locationBias: SOCAL_BIAS,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.warn(JSON.stringify({ event: "places_autocomplete", status: response.status }));
    return json({ ok: false, code: "upstream", suggestions: [] });
  }
  const data = (await response.json()) as {
    suggestions?: Array<{ placePrediction?: { placeId?: string; text?: { text?: string } } }>;
  };
  const suggestions = (data.suggestions ?? [])
    .map((s) => ({ id: s.placePrediction?.placeId ?? "", text: (s.placePrediction?.text?.text ?? "").replace(/, USA$/, "") }))
    .filter((s) => s.id && s.text)
    .slice(0, 5);
  return json({ ok: true, suggestions });
}
