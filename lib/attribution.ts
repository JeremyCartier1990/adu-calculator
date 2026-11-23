import { BRAND } from "./brand";
import { CLICK_ID_PARAMS, CLICK_STORE_KEY, REDTRACK_DOMAIN, readClickId } from "./redtrack";

// Where a lead came from: UTM parameters and ad click ids from the landing URL,
// kept for the visit so they survive the funnel and reach the lead webhook.
//
// RedTrack's universal script only treats `rtkcid` as an already-known click, and it
// writes `rtkclickid-store` with an empty `domain=`, which the browser rejects. Ad URLs
// also arrive as clickid / rtkclickid / rt_clickid. We copy whichever alias is present
// into `rtkcid` and store that id in a first-party cookie so a later page can still send it.
// When the landing has `cmpid` but no click id, we wait briefly for the script to produce
// one. If that request never starts (sessionStorage throws in the Facebook in-app browser),
// we call the same click endpoint once. A click the script already requested is not repeated.

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
  "clickid",
  "rtkclickid",
  "rt_clickid",
  "cmpid",
  "sub1",
  "sub2",
  "sub3",
  "sub4",
  "sub5",
  "sub6",
  "sub7",
  "sub8",
] as const;

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>> & {
  landingPage?: string;
  referrer?: string;
};

const STORE_KEY = "lead-attribution";
const MAX = 500;
/** Same lifetime as the universal script's cookieduration. */
const CLICK_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
/** How long to wait for uniclick.js, and how long the one fallback request may take. */
const SCRIPT_WAIT_MS = 4000;

const clip = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, MAX) : undefined);

type TrackerXhr = { readyState: number; status?: number; responseText?: string };
type RedTrackWindow = Window & { rtkClickID?: string; rtkxhr?: TrackerXhr };

let memoryClickId: string | undefined;
let memoryCmpid: string | undefined;
let pendingClick: Promise<string | null> | null = null;
/** cmpid we already waited on, so a second call does not wait or fetch again. */
let attemptedCmpid: string | undefined;

/** Clears in-memory click resolution. Tests only. */
export function resetClickCaptureForTests() {
  memoryClickId = undefined;
  memoryCmpid = undefined;
  pendingClick = null;
  attemptedCmpid = undefined;
}

function browser(): RedTrackWindow | null {
  if (typeof window === "undefined") return null;
  return window as RedTrackWindow;
}

function searchParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function clickIdFromSearch(params: URLSearchParams): string | undefined {
  for (const key of CLICK_ID_PARAMS) {
    const value = clip(params.get(key));
    if (value) return value;
  }
  return undefined;
}

/** Campaign ids are a path segment. Anything else is ignored instead of requested. */
function safeCmpid(value: string | null): string | undefined {
  const cmpid = clip(value);
  if (!cmpid || !/^[A-Za-z0-9_-]{1,128}$/.test(cmpid)) return undefined;
  return cmpid;
}

function storedClickId(): string | undefined {
  try {
    const stored = window.localStorage.getItem(STORE_KEY);
    if (!stored) return undefined;
    return parseAttribution(JSON.parse(stored))?.rtkcid;
  } catch {
    return undefined;
  }
}

/** Host-only on preview and localhost; Domain=aduroicalculator.com on the public site. */
export function persistClickId(id: string) {
  const value = clip(id);
  if (!value || typeof document === "undefined") return;
  try {
    const host = window.location.hostname;
    const onBrand = host === BRAND.domain || host.endsWith(`.${BRAND.domain}`);
    const domain = onBrand ? `; Domain=${BRAND.domain}` : "";
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CLICK_STORE_KEY}=${encodeURIComponent(value)}; Max-Age=${CLICK_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${domain}${secure}`;
    window.localStorage.setItem(CLICK_STORE_KEY, value);
  } catch {
    // Cookies or storage blocked.
  }
}

function mergeStoredClickId(id: string) {
  const value = clip(id);
  if (!value) return;
  try {
    const stored = window.localStorage.getItem(STORE_KEY);
    const current: Attribution = stored ? (parseAttribution(JSON.parse(stored)) ?? {}) : {};
    current.rtkcid = value;
    window.localStorage.setItem(STORE_KEY, JSON.stringify(current));
  } catch {
    // Storage blocked.
  }
}

function remember(id: string) {
  const value = clip(id);
  if (!value) return;
  memoryClickId = value;
  try {
    memoryCmpid = safeCmpid(searchParams().get("cmpid"));
  } catch {
    memoryCmpid = undefined;
  }
  persistClickId(value);
  mergeStoredClickId(value);
}

/** Id the universal script has resolved in this tab. The leftover cookie is not included. */
function liveScriptId(): string | undefined {
  const view = browser();
  if (!view) return undefined;
  const fromGlobal = clip(view.rtkClickID);
  if (fromGlobal) return fromGlobal;
  try {
    const fromSession = clip(view.sessionStorage?.getItem("rtkclickid"));
    if (fromSession) return fromSession;
  } catch {
    // sessionStorage throws in the Facebook in-app browser; the script then never sends.
  }
  const xhr = view.rtkxhr;
  if (xhr && xhr.readyState === 4 && xhr.status === 200 && xhr.responseText) {
    try {
      const data = JSON.parse(xhr.responseText) as { clickid?: unknown };
      return clip(data?.clickid);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** True while uniclick's click request is in flight or already succeeded. A failed or unsent request is not. */
function scriptOwnsClick(): boolean {
  const xhr = browser()?.rtkxhr;
  if (!xhr || xhr.readyState === 0) return false;
  if (xhr.readyState < 4) return true;
  return xhr.status === 200;
}

function waitForScript(): Promise<void> {
  if (liveScriptId() || browser()?.rtkxhr?.readyState === 4) return Promise.resolve();
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const xhr = browser()?.rtkxhr;
      if (liveScriptId() || xhr?.readyState === 4 || Date.now() - started >= SCRIPT_WAIT_MS) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });
}

async function fetchClickOnce(cmpid: string): Promise<string | null> {
  if (typeof fetch !== "function") return null;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), SCRIPT_WAIT_MS);
  try {
    const page = new URL(window.location.href);
    const endpoint = new URL(`${REDTRACK_DOMAIN}/${cmpid}`);
    endpoint.searchParams.set("format", "json");
    const referrer = typeof document !== "undefined" ? document.referrer : "";
    if (referrer) endpoint.searchParams.set("referrer", referrer);
    page.searchParams.forEach((value, key) => {
      if (!endpoint.searchParams.has(key)) endpoint.searchParams.append(key, value);
    });
    const response = await fetch(endpoint.toString(), {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { clickid?: unknown };
    const id = clip(data?.clickid);
    if (!id) return null;
    remember(id);
    return id;
  } catch {
    // CORS and network failures must not surface to the funnel.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function settleClickId(): Promise<string | null> {
  const params = searchParams();
  const fromUrl = clickIdFromSearch(params);
  if (fromUrl) {
    remember(fromUrl);
    return fromUrl;
  }
  const cmpid = safeCmpid(params.get("cmpid"));
  if (cmpid) {
    if (memoryClickId && memoryCmpid === cmpid) return memoryClickId;
    const live = liveScriptId();
    if (live) {
      remember(live);
      return live;
    }
    if (attemptedCmpid === cmpid) return memoryClickId ?? null;
    attemptedCmpid = cmpid;
    await waitForScript();
    const resolved = liveScriptId();
    if (resolved) {
      remember(resolved);
      return resolved;
    }
    // The script already asked tracking.zip-estimate.com. A second click would be a different id.
    if (scriptOwnsClick()) return null;
    return fetchClickOnce(cmpid);
  }
  if (memoryClickId) return memoryClickId;
  const stored = storedClickId();
  if (stored) return stored;
  const saved = clip(readClickId());
  if (saved) remember(saved);
  return saved ?? null;
}

/**
 * Resolves the click id for this page. Safe to call more than once: the campaign fallback
 * runs at most once, and a URL click id returns immediately.
 */
export function ensureClickId(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (pendingClick) return pendingClick;
  const job = settleClickId()
    .catch(() => null)
    .finally(() => {
      if (pendingClick === job) pendingClick = null;
    });
  pendingClick = job;
  return job;
}

/**
 * Call on page load. A URL that carries any tracking parameter replaces what was
 * kept (last click wins, like the ad platforms); a plain visit keeps the earlier one.
 */
export function captureAttribution() {
  try {
    const params = searchParams();
    const urlClick = clickIdFromSearch(params);
    const cmpid = safeCmpid(params.get("cmpid"));
    if (cmpid && !urlClick && memoryCmpid !== cmpid) memoryClickId = undefined;
    if (!ATTRIBUTION_KEYS.some((key) => params.has(key)) && window.localStorage.getItem(STORE_KEY)) {
      if (urlClick) remember(urlClick);
      void ensureClickId();
      return;
    }
    const next: Attribution = { landingPage: clip(window.location.href), referrer: clip(document.referrer) };
    for (const key of ATTRIBUTION_KEYS) next[key] = clip(params.get(key));
    if (urlClick) next.rtkcid = urlClick;
    else if (memoryClickId && memoryCmpid === cmpid) next.rtkcid = memoryClickId;
    else if (!cmpid) {
      const saved = storedClickId() || clip(readClickId());
      if (saved) next.rtkcid = saved;
    }
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
    if (next.rtkcid) persistClickId(next.rtkcid);
    void ensureClickId();
  } catch {
    // Storage blocked (private mode): the lead still goes through without it.
  }
}

/** A new campaign without a click id must not inherit a previous visit's id. */
function awaitingNewClick(params: URLSearchParams): boolean {
  return Boolean(safeCmpid(params.get("cmpid"))) && !clickIdFromSearch(params) && !memoryClickId;
}

function withoutClick(kept: Attribution | null): Attribution | null {
  if (!kept) return null;
  const rest: Attribution = { ...kept };
  delete rest.rtkcid;
  delete rest.clickid;
  delete rest.rtkclickid;
  delete rest.rt_clickid;
  return Object.keys(rest).length > 0 ? rest : null;
}

/** What was kept, plus the RedTrack click id once this page has one. */
export function readAttribution(): Attribution | null {
  let kept: Attribution | null = null;
  try {
    const stored = window.localStorage.getItem(STORE_KEY);
    kept = stored ? parseAttribution(JSON.parse(stored)) : null;
  } catch {
    kept = null;
  }
  try {
    const params = searchParams();
    const fromUrl = clickIdFromSearch(params);
    if (fromUrl) return { ...kept, rtkcid: fromUrl };
    if (awaitingNewClick(params)) {
      const live = liveScriptId();
      return live ? { ...kept, rtkcid: live } : withoutClick(kept);
    }
  } catch {
    // location unavailable
  }
  const rtkcid = clip(kept?.rtkcid) || clip(readClickId());
  return rtkcid ? { ...kept, rtkcid } : kept;
}

/** Waits out an in-flight click resolution, then returns what will be sent with the lead. Never throws. */
export async function readAttributionForLead(): Promise<Attribution | null> {
  try {
    await ensureClickId();
  } catch {
    // Tracking must not block the lead.
  }
  return readAttribution();
}

/** Server side: only the known keys, as short strings. A click-id alias is copied onto `rtkcid`. */
export function parseAttribution(input: unknown): Attribution | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const out: Attribution = {};
  for (const key of [...ATTRIBUTION_KEYS, "landingPage", "referrer"] as const) {
    const value = clip(record[key]);
    if (value) out[key] = value;
  }
  if (!out.rtkcid) {
    for (const key of CLICK_ID_PARAMS) {
      if (key === "rtkcid") continue;
      if (out[key]) {
        out.rtkcid = out[key];
        break;
      }
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
