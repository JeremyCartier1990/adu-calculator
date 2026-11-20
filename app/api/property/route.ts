import { validateAddress } from "@/lib/address";
import type { PropertyLookup } from "@/lib/api-types";
import { lookupPropertyReach, propertyReachConfigured } from "@/lib/propertyreach";
import { clientIp, RATE_LIMITS, takeToken } from "@/lib/rate-limit";
import {
  hasFreshRentCastCache,
  lookupProperty,
  propertyRequestUrls,
  RENTCAST_NOT_CONFIGURED_MESSAGE,
} from "@/lib/rentcast";
import { enableSharedPropertyReachCache } from "@/lib/propertyreach-cache";
import { enableSharedRentCastCache } from "@/lib/rentcast-cache";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  enableSharedRentCastCache();
  enableSharedPropertyReachCache();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "bad_request", message: "Send a JSON body with an address." }, 400);
  }

  const parsed = validateAddress((body as { address?: unknown }).address);
  if (!parsed.ok) {
    return json({ ok: false, code: "bad_address", message: parsed.message }, 400);
  }

  const rentCastReady = Boolean(process.env.RENTCAST_API_KEY?.trim());
  if (!rentCastReady && !propertyReachConfigured()) {
    return json({ ok: false, code: "not_configured", message: RENTCAST_NOT_CONFIGURED_MESSAGE });
  }

  const urls = propertyRequestUrls(parsed.address);
  const needsNetwork = !rentCastReady || !hasFreshRentCastCache(urls.records) || !hasFreshRentCastCache(urls.value);
  if (
    needsNetwork &&
    !takeToken("property", clientIp(request), RATE_LIMITS.property.limit, RATE_LIMITS.property.windowMs)
  ) {
    return json(
      {
        ok: false,
        code: "rate_limited",
        message: "Too many lookups from this network. Try again later, or enter the details yourself.",
      },
      429,
    );
  }

  // RentCast first; PropertyReach (a paid credit per lookup) when RentCast is off or finds nothing.
  let result: PropertyLookup = rentCastReady
    ? await lookupProperty(parsed.address)
    : { ok: false, code: "not_configured", message: RENTCAST_NOT_CONFIGURED_MESSAGE };
  let source = "rentcast";
  if (!result.ok && propertyReachConfigured()) {
    const fallback = await lookupPropertyReach(parsed.address);
    if (fallback.ok || result.code === "not_configured") {
      result = fallback;
      source = "propertyreach";
    }
  }
  console.info(
    JSON.stringify({
      event: "property_lookup",
      source,
      ok: result.ok,
      cached: result.ok ? result.cached : false,
      code: result.ok ? "ok" : result.code,
    }),
  );

  if (result.ok) return json(result);
  if (result.code === "not_found") return json(result, 404);
  if (result.code === "not_configured") return json(result);
  return json(result, 502);
}
