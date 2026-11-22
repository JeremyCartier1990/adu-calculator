/**
 * The Maps JavaScript API runs in the browser, so it needs the key there. That's
 * how Google browser keys work: the key's HTTP-referrer restriction is what keeps
 * other sites from using it.
 *
 * GOOGLE_MAPS_BROWSER_KEY is that referrer-restricted key, with the Maps JavaScript
 * API allowed. GOOGLE_MAPS_API_KEY stays the server key for address suggestions,
 * which Google refuses to serve with a referrer-restricted key. It must never reach the browser.
 */
export async function GET(): Promise<Response> {
  // Never fall back to the server key: whatever this returns is public.
  const key = process.env.GOOGLE_MAPS_BROWSER_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || null;
  return Response.json({ key }, { headers: { "Cache-Control": "no-cache" } });
}
