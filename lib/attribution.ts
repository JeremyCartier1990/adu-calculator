import { readClickId } from "./redtrack";

// Where a lead came from: UTM parameters and ad click ids from the landing URL,
// kept for the visit so they survive the funnel and reach the lead webhook.

export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "rtkcid",
] as const;

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>> & {
  landingPage?: string;
  referrer?: string;
};

const STORE_KEY = "lead-attribution";
const MAX = 500;

const clip = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, MAX) : undefined);

/**
 * Call on page load. A URL that carries any tracking parameter replaces what was
 * kept (last click wins, like the ad platforms); a plain visit keeps the earlier one.
 */
export function captureAttribution() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!ATTRIBUTION_KEYS.some((key) => params.has(key)) && window.localStorage.getItem(STORE_KEY)) return;
    const next: Attribution = { landingPage: clip(window.location.href), referrer: clip(document.referrer) };
    for (const key of ATTRIBUTION_KEYS) next[key] = clip(params.get(key));
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private mode): the lead still goes through without it.
  }
}

/** What was kept, plus the RedTrack click id its script stored (it isn't always in the landing URL). */
export function readAttribution(): Attribution | null {
  let kept: Attribution | null = null;
  try {
    const stored = window.localStorage.getItem(STORE_KEY);
    kept = stored ? parseAttribution(JSON.parse(stored)) : null;
  } catch {
    kept = null;
  }
  const rtkcid = clip(readClickId());
  return rtkcid ? { ...kept, rtkcid } : kept;
}

/** Server side: only the known keys, as short strings. */
export function parseAttribution(input: unknown): Attribution | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const out: Attribution = {};
  for (const key of [...ATTRIBUTION_KEYS, "landingPage", "referrer"] as const) {
    const value = clip(record[key]);
    if (value) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}
