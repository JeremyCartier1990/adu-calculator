// RedTrack conversion tracking. The universal script (loaded in app/layout.tsx) records the paid click's id;
// when a homeowner becomes a lead we post that click id back to RedTrack as a conversion.

export const REDTRACK_DOMAIN = "https://tracking.zip-estimate.com";
export const REDTRACK_SCRIPT = `${REDTRACK_DOMAIN}/uniclick.js?attribution=lastpaid&cookiedomain=&cookieduration=90&defaultcampaignid=&regviewonce=false&script_id=6aff8bc17869bd043446030f`;

// Must match a conversion type configured in RedTrack.
const LEAD_TYPE = "Lead";
const STORE_KEY = "rtkclickid-store";

/** The paid click id: from the URL, or where the RedTrack script stored it. */
export function readClickId(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get("rtkcid");
  if (fromUrl) return fromUrl;
  const cookie = document.cookie.split("; ").find((part) => part.startsWith(`${STORE_KEY}=`));
  if (cookie) return decodeURIComponent(cookie.slice(STORE_KEY.length + 1));
  try {
    return window.localStorage.getItem(STORE_KEY);
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
