import { cookies } from "next/headers";
import { hasTeamAccess } from "@/lib/admin-auth";
import { AIRROI_NOT_CONFIGURED_MESSAGE, buildAirRoiUrl, hasFreshAirRoiCache, lookupShortTerm } from "@/lib/airroi";
import { ASSUMPTIONS, guestsForBedrooms } from "@/lib/assumptions";
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
  // One AirROI query per map point, always about the reference unit; the builder
  // scales the nightly rate to the ADU's own bedroom count.
  const referenceBedrooms = ASSUMPTIONS.rent.reference.bedrooms;
  const query = { latitude, longitude, bedrooms: referenceBedrooms, baths: ASSUMPTIONS.rent.bathrooms, guests: guestsForBedrooms(referenceBedrooms) };

  const url = buildAirRoiUrl(query);
  if (!hasFreshAirRoiCache(url) && !takeToken("str", clientIp(request), RATE_LIMITS.str.limit, RATE_LIMITS.str.windowMs)) {
    return json(
      { ok: false, code: "rate_limited", message: "Too many short-term lookups. The planning estimate is still available." },
      429,
    );
  }

  const result = await lookupShortTerm(query);
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
  return json(result.ok ? { ...result, referenceBedrooms } : result);
}
