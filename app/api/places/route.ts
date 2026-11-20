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

  // Keys restricted to website referrers check this header, and a server request has none of its own.
  const referer = `${new URL(request.url).origin}/`;
  const modern = await autocompleteNew(key, referer, input, sessionToken);
  if (modern.ok) return json({ ok: true, suggestions: modern.suggestions });
  // Older keys and projects may only allow the legacy Places API.
  const legacy = await autocompleteLegacy(key, referer, input, sessionToken);
  if (legacy.ok) return json({ ok: true, suggestions: legacy.suggestions });
  console.warn(JSON.stringify({ event: "places_autocomplete", modern: modern.reason, legacy: legacy.reason }));
  return json({ ok: false, code: "upstream", reason: modern.reason, suggestions: [] });
}

type Suggestion = { id: string; text: string };
type Lookup = { ok: true; suggestions: Suggestion[] } | { ok: false; reason: string };

const tidy = (suggestions: Suggestion[]) =>
  suggestions
    .map((s) => ({ ...s, text: s.text.replace(/, USA$/, "") }))
    .filter((s) => s.id && s.text)
    .slice(0, 5);

/** Places Autocomplete (New). */
async function autocompleteNew(key: string, referer: string, input: string, sessionToken?: string): Promise<Lookup> {
  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "suggestions.placePrediction.text.text,suggestions.placePrediction.placeId",
      Referer: referer,
    },
    body: JSON.stringify({
      input,
      sessionToken,
      includedRegionCodes: ["us"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
      locationBias: SOCAL_BIAS,
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!response) return { ok: false, reason: "network" };
  const data = (await response.json().catch(() => ({}))) as {
    suggestions?: Array<{ placePrediction?: { placeId?: string; text?: { text?: string } } }>;
    error?: { status?: string; details?: Array<{ reason?: string }> };
  };
  if (!response.ok) {
    const reason = data.error?.details?.find((d) => d.reason)?.reason ?? data.error?.status ?? `http_${response.status}`;
    return { ok: false, reason };
  }
  return {
    ok: true,
    suggestions: tidy(
      (data.suggestions ?? []).map((s) => ({ id: s.placePrediction?.placeId ?? "", text: s.placePrediction?.text?.text ?? "" })),
    ),
  };
}

/** Legacy Places Autocomplete, for keys that predate Places API (New). */
async function autocompleteLegacy(key: string, referer: string, input: string, sessionToken?: string): Promise<Lookup> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", input);
  url.searchParams.set("key", key);
  url.searchParams.set("types", "address");
  url.searchParams.set("components", "country:us");
  url.searchParams.set("locationbias", "rectangle:32.5,-119.5|34.9,-116.5");
  if (sessionToken) url.searchParams.set("sessiontoken", sessionToken);
  const response = await fetch(url, { headers: { Referer: referer }, cache: "no-store" }).catch(() => null);
  if (!response) return { ok: false, reason: "network" };
  const data = (await response.json().catch(() => ({}))) as {
    status?: string;
    predictions?: Array<{ place_id?: string; description?: string }>;
  };
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") return { ok: false, reason: data.status ?? `http_${response.status}` };
  return { ok: true, suggestions: tidy((data.predictions ?? []).map((p) => ({ id: p.place_id ?? "", text: p.description ?? "" }))) };
}
