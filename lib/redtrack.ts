// RedTrack conversion tracking. The universal script (loaded in app/layout.tsx) records the paid click's id;
// when a homeowner becomes a lead we post that click id back to RedTrack as a conversion.

export const REDTRACK_DOMAIN = "https://tracking.zip-estimate.com";
export const REDTRACK_SCRIPT = `${REDTRACK_DOMAIN}/uniclick.js?attribution=lastpaid&cookiedomain=&cookieduration=90&defaultcampaignid=&regviewonce=false&script_id=6aff8bc17869bd043446030f`;

// Must match a conversion type configured in RedTrack.
const LEAD_TYPE = "Lead";
/** Cookie and localStorage key the universal script uses. Its own write sets `domain=` (empty), which browsers drop. */
export const CLICK_STORE_KEY = "rtkclickid-store";

/**
 * Query params that carry an already-known click, first match wins.
 * The universal script only honors `rtkcid`; ad links also use the other three.
 */
export const CLICK_ID_PARAMS = ["rtkcid", "clickid", "rtkclickid", "rt_clickid"] as const;

function cleanClickId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return null;
  return trimmed;
}

/** The paid click id: from the URL (any accepted alias), then the script cookie, then localStorage. */
export function readClickId(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of CLICK_ID_PARAMS) {
      const fromUrl = cleanClickId(params.get(key));
      if (fromUrl) return fromUrl;
    }
  } catch {
    // location unavailable
  }
  try {
    const cookie = document.cookie.split("; ").find((part) => part.startsWith(`${CLICK_STORE_KEY}=`));
    if (cookie) {
      const raw = cookie.slice(CLICK_STORE_KEY.length + 1);
      let decoded = raw;
      try {
        decoded = decodeURIComponent(raw);
      } catch {
        // keep the raw value
      }
      const fromCookie = cleanClickId(decoded);
      if (fromCookie) return fromCookie;
    }
  } catch {
    // cookies blocked
  }
  try {
    return cleanClickId(window.localStorage.getItem(CLICK_STORE_KEY));
  } catch {
    return null;
  }
}

/** Report a lead conversion for the visitor's paid click, once per report. Visitors without a click id are skipped. */
export function trackLeadConversion(reportId: string) {
  const clickId = readClickId();
  if (!clickId) return;
  const url = new URL("/postback", REDTRACK_DOMAIN);
  url.searchParams.set("clickid", clickId);
  url.searchParams.set("type", LEAD_TYPE);
  url.searchParams.set("orderid", reportId);
  // An image beacon needs no CORS and survives the page scrolling away.
  new Image().src = url.toString();
}
