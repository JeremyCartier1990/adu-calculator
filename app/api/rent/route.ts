import { validateAddress } from "@/lib/address";
import { clientIp, RATE_LIMITS, takeToken } from "@/lib/rate-limit";
import {
  hasFreshRentCastCache,
  lookupRent,
  rentRequestUrl,
  RENTCAST_NOT_CONFIGURED_MESSAGE,
} from "@/lib/rentcast";
import { enableSharedRentCastCache } from "@/lib/rentcast-cache";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  enableSharedRentCastCache();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      { ok: false, code: "bad_request", message: "Send a JSON body with an address and ADU size." },
      400,
    );
  }

  const record = body as { address?: unknown; squareFootage?: unknown; bedrooms?: unknown };
  const parsed = validateAddress(record.address);
  if (!parsed.ok) {
    return json({ ok: false, code: "bad_address", message: parsed.message }, 400);
  }

  const squareFootage = record.squareFootage;
  const bedrooms = record.bedrooms;
  if (typeof squareFootage !== "number" || !Number.isFinite(squareFootage) || squareFootage < 100) {
    return json({ ok: false, code: "bad_request", message: "Send an ADU size in square feet." }, 400);
  }
  if (typeof bedrooms !== "number" || !Number.isFinite(bedrooms) || bedrooms < 0 || bedrooms > 6) {
    return json({ ok: false, code: "bad_request", message: "Send a bedroom count from 0 to 6." }, 400);
  }

  if (!process.env.RENTCAST_API_KEY?.trim()) {
    return json({ ok: false, code: "not_configured", message: RENTCAST_NOT_CONFIGURED_MESSAGE });
  }

  const url = rentRequestUrl(parsed.address, squareFootage, bedrooms);
  if (!hasFreshRentCastCache(url) && !takeToken("rent", clientIp(request), RATE_LIMITS.rent.limit, RATE_LIMITS.rent.windowMs)) {
    return json(
      {
        ok: false,
        code: "rate_limited",
        message: "Too many rent checks from this network. Edit the monthly rent yourself for now.",
      },
      429,
    );
  }

  const result = await lookupRent(parsed.address, squareFootage, bedrooms);
  console.info(
    JSON.stringify({
      event: "rent_lookup",
      ok: result.ok,
      cached: result.ok ? result.cached : false,
      code: result.ok ? "ok" : result.code,
      squareFootage: result.ok ? result.squareFootage : null,
    }),
  );

  if (result.ok) return json(result);
  if (result.code === "not_found") return json(result, 404);
  if (result.code === "not_configured") return json(result);
  return json(result, 502);
}
