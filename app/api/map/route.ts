import { clientIp, takeToken } from "@/lib/rate-limit";

/**
 * Satellite image of a property from the Google Maps Static API, proxied so the
 * key stays on the server. The key must allow the Maps Static API; until it does,
 * this answers 404 and the page hides the map.
 */
export async function GET(request: Request): Promise<Response> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return new Response(null, { status: 404 });
  if (!takeToken("map", clientIp(request), 120, 60 * 60 * 1000)) return new Response(null, { status: 429 });

  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const address = params.get("address")?.trim().slice(0, 200) ?? "";
  const hasPoint = params.has("lat") && params.has("lng") && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if (!hasPoint && !address) return new Response(null, { status: 400 });
  const center = hasPoint ? `${lat.toFixed(6)},${lng.toFixed(6)}` : address;

  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", center);
  url.searchParams.set("zoom", "20");
  url.searchParams.set("size", "640x400");
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "satellite");
  url.searchParams.set("key", key);
  // The key is restricted to the site's referrers, so send this site as the referrer.
  const upstream = await fetch(url, { headers: { Referer: `${new URL(request.url).origin}/` } }).catch(() => null);
  const type = upstream?.headers.get("content-type") ?? "";
  if (!upstream?.ok || !type.startsWith("image/")) return new Response(null, { status: 404 });

  return new Response(upstream.body, {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, s-maxage=604800" },
  });
}
