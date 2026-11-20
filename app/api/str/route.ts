import { cookies } from "next/headers";
import { hasTeamAccess } from "@/lib/admin-auth";
import { AIRROI_NOT_CONFIGURED_MESSAGE, buildAirRoiUrl, hasFreshAirRoiCache, lookupShortTerm } from "@/lib/airroi";
import { guestsForBedrooms } from "@/lib/assumptions";
import { enableSharedAirRoiCache } from "@/lib/airroi-cache";
import { clientIp, RATE_LIMITS, takeToken } from "@/lib/rate-limit";
import { verifiedPhoneFromRequest } from "@/lib/verify-cookie";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  enableSharedAirRoiCache();

  const phone = verifiedPhoneFromRequest(request);
  if (!phone && !hasTeamAccess(await cookies())) {
    return json(
      {
        ok: false,
        code: "verification_required",
        message: "Verify your phone before loading short-term market data.",
      },
      401,
    );
  }

  if (!process.env.AIRROI_API_KEY?.trim()) {
    return json({ ok: false, code: "not_configured", message: AIRROI_NOT_CONFIGURED_MESSAGE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "bad_request", message: "Send the ADU location and size." }, 400);
  }

  const record = body as { latitude?: unknown; longitude?: unknown; bedrooms?: unknown; baths?: unknown; guests?: unknown };
  const latitude = typeof record.latitude === "number" ? record.latitude : Number.NaN;
  const longitude = typeof record.longitude === "number" ? record.longitude : Number.NaN;
  const bedrooms = typeof record.bedrooms === "number" ? record.bedrooms : Number.NaN;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || (latitude === 0 && longitude === 0)) {
    return json({ ok: false, code: "bad_request", message: "A map point from the property lookup is required." }, 400);
  }
  if (!Number.isFinite(bedrooms) || bedrooms < 0 || bedrooms > 6) {
    return json({ ok: false, code: "bad_request", message: "Send the ADU bedroom count." }, 400);
  }
  const baths = typeof record.baths === "number" && record.baths >= 0.5 && record.baths <= 6 ? record.baths : 1;
  const guests =
    typeof record.guests === "number" && record.guests >= 1 && record.guests <= 16
      ? Math.round(record.guests)
      : guestsForBedrooms(bedrooms);

  const url = buildAirRoiUrl({ latitude, longitude, bedrooms, baths, guests });
  if (!hasFreshAirRoiCache(url) && !takeToken("str", clientIp(request), RATE_LIMITS.str.limit, RATE_LIMITS.str.windowMs)) {
    return json(
      { ok: false, code: "rate_limited", message: "Too many short-term lookups. The planning estimate is still available." },
      429,
    );
  }

  const result = await lookupShortTerm({ latitude, longitude, bedrooms, baths, guests });
  console.info(
    JSON.stringify({
      event: "str_lookup",
      ok: result.ok,
      cached: result.ok ? result.cached : false,
      code: result.ok ? "ok" : result.code,
    }),
  );
  if (!result.ok && result.code === "not_found") return json(result, 404);
  if (!result.ok && result.code === "upstream") return json(result, 502);
  return json(result);
}
