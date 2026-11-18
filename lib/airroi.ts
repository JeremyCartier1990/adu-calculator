import { ASSUMPTIONS } from "./assumptions";

export class AirRoiError extends Error {
  constructor(
    public code: "not_configured" | "upstream" | "bad_response",
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "AirRoiError";
  }
}

export const AIRROI_NOT_CONFIGURED_MESSAGE =
  "Short-term market data isn't connected. The nightly figure stays a planning estimate.";

export type PercentBand = {
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
};

export type StrMonth = { label: string; revenue: number };

export type StrComp = {
  name: string;
  bedrooms: number | null;
  adr: number | null;
  occupancy: number | null;
  revenue: number | null;
};

export type StrEstimate = {
  adr: number;
  occupancy: number;
  annualRevenue: number;
  monthlyRevenue: number;
  currency: string;
  percentiles: {
    revenue: PercentBand;
    adr: PercentBand;
    occupancy: PercentBand;
  };
  months: StrMonth[];
  comps: StrComp[];
  compCount: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Payload = { ok: true; body: unknown } | { ok: false; code: "not_found" };
type CacheEntry = { expires: number; value: Payload };
type Loader = (url: string) => Promise<Payload>;

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Payload>>();
let persistentLoader: Loader | null = null;

export function setAirRoiPersistentLoader(loader: Loader | null): void {
  persistentLoader = loader;
}

export function resetAirRoiForTests(): void {
  memory.clear();
  inflight.clear();
  persistentLoader = null;
}

export function hasFreshAirRoiCache(url: string): boolean {
  const hit = memory.get(url);
  return Boolean(hit && hit.expires > Date.now());
}

export function buildAirRoiUrl(input: {
  latitude: number;
  longitude: number;
  bedrooms: number;
  baths: number;
  guests: number;
}): string {
  const url = new URL("https://api.airroi.com/calculator/estimate");
  url.searchParams.set("lat", roundCoord(input.latitude).toFixed(4));
  url.searchParams.set("lng", roundCoord(input.longitude).toFixed(4));
  url.searchParams.set("bedrooms", String(Math.min(20, Math.max(0, Math.round(input.bedrooms)))));
  url.searchParams.set("baths", String(input.baths));
  url.searchParams.set("guests", String(Math.min(30, Math.max(1, Math.round(input.guests)))));
  url.searchParams.set("currency", "usd");
  url.searchParams.set("room_type", "entire_home");
  return url.toString();
}

function roundCoord(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export async function requestAirRoi(url: string): Promise<Payload> {
  const apiKey = process.env.AIRROI_API_KEY?.trim();
  if (!apiKey) throw new AirRoiError("not_configured", AIRROI_NOT_CONFIGURED_MESSAGE);
  console.info(JSON.stringify({ event: "airroi_upstream", path: "/calculator/estimate" }));
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", "X-API-KEY": apiKey },
    cache: "no-store",
  });
  if (response.status === 404) return { ok: false, code: "not_found" };
  if (!response.ok) {
    throw new AirRoiError("upstream", `AirROI request failed (${response.status}).`, response.status);
  }
  try {
    return { ok: true, body: await response.json() };
  } catch {
    throw new AirRoiError("bad_response", "AirROI returned an unreadable response.", response.status);
  }
}

async function remember(url: string): Promise<{ payload: Payload; cached: boolean }> {
  const hit = memory.get(url);
  if (hit && hit.expires > Date.now()) return { payload: hit.value, cached: true };
  const pending = inflight.get(url);
  if (pending) return { payload: await pending, cached: true };
  const promise = (persistentLoader ? persistentLoader(url) : requestAirRoi(url))
    .then((payload) => {
      memory.set(url, { expires: Date.now() + ASSUMPTIONS.cacheTtlMs, value: payload });
      inflight.delete(url);
      return payload;
    })
    .catch((error: unknown) => {
      inflight.delete(url);
      throw error;
    });
  inflight.set(url, promise);
  return { payload: await promise, cached: false };
}

export async function airRoiGet(url: string): Promise<{ payload: Payload; cached: boolean }> {
  if (!process.env.AIRROI_API_KEY?.trim()) {
    throw new AirRoiError("not_configured", AIRROI_NOT_CONFIGURED_MESSAGE);
  }
  return remember(url);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function band(value: unknown): PercentBand {
  const record = asRecord(value);
  const pick = (key: string) => {
    const parsed = asNumber(record?.[key]);
    return parsed == null ? null : parsed;
  };
  return { p25: pick("p25"), p50: pick("p50"), p75: pick("p75"), p90: pick("p90") };
}

export function monthlyDollars(annual: number, raw: unknown): StrMonth[] {
  if (!Array.isArray(raw) || raw.length < 12) return [];
  const values = raw.slice(0, 12).map((value) => {
    const parsed = asNumber(value);
    return parsed == null || parsed < 0 ? 0 : parsed;
  });
  const sum = values.reduce((total, value) => total + value, 0);
  const shares = sum > 0 && sum <= 1.5 && values.every((value) => value <= 1.5);
  return values.map((value, index) => ({
    label: MONTHS[index] ?? "",
    revenue: Math.round(shares ? annual * value : value),
  }));
}

function occupancyRate(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed == null || parsed <= 0) return null;
  const rate = parsed > 1 && parsed <= 100 ? parsed / 100 : parsed;
  if (rate <= 0 || rate > 1) return null;
  return rate;
}

function compFrom(value: unknown): StrComp | null {
  const record = asRecord(value);
  if (!record) return null;
  const info = asRecord(record.listing_info);
  const metrics = asRecord(record.performance_metrics);
  const details = asRecord(record.property_details);
  const name =
    (typeof info?.listing_name === "string" && info.listing_name.trim()) ||
    (typeof record.name === "string" && record.name.trim()) ||
    "Nearby listing";
  return {
    name: name.slice(0, 80),
    bedrooms: asNumber(details?.bedrooms ?? record.bedrooms),
    adr: asNumber(metrics?.ttm_avg_rate ?? record.average_daily_rate ?? record.adr),
    occupancy: occupancyRate(metrics?.ttm_occupancy ?? record.occupancy),
    revenue: asNumber(metrics?.ttm_revenue ?? record.ttm_revenue ?? record.revenue),
  };
}

export function parseAirRoiBody(body: unknown): StrEstimate | null {
  const record = asRecord(body);
  if (!record) return null;
  const annual = asNumber(record.revenue);
  const adr = asNumber(record.average_daily_rate ?? record.adr);
  const occupancy = occupancyRate(record.occupancy);
  if (annual == null || annual <= 0 || adr == null || adr <= 0 || occupancy == null) return null;
  const percentiles = asRecord(record.percentiles);
  const compsRaw = Array.isArray(record.comparable_listings) ? record.comparable_listings : [];
  const comps = compsRaw.map(compFrom).filter((comp): comp is StrComp => comp != null).slice(0, 5);
  return {
    adr: Math.round(adr),
    occupancy,
    annualRevenue: Math.round(annual),
    monthlyRevenue: Math.round(annual / 12),
    currency: typeof record.currency === "string" ? record.currency.slice(0, 8) : "USD",
    percentiles: {
      revenue: band(percentiles?.revenue),
      adr: band(percentiles?.average_daily_rate ?? percentiles?.adr),
      occupancy: band(percentiles?.occupancy),
    },
    months: monthlyDollars(annual, record.monthly_revenue_distributions),
    comps,
    compCount: compsRaw.length,
  };
}

export async function lookupShortTerm(input: {
  latitude: number;
  longitude: number;
  bedrooms: number;
  baths: number;
  guests: number;
}): Promise<{ ok: true; cached: boolean; estimate: StrEstimate } | { ok: false; code: string; message: string }> {
  const url = buildAirRoiUrl(input);
  try {
    const result = await airRoiGet(url);
    if (!result.payload.ok) {
      return { ok: false, code: "not_found", message: "No short-term comps were found for that spot." };
    }
    const estimate = parseAirRoiBody(result.payload.body);
    if (!estimate) {
      return { ok: false, code: "upstream", message: "The short-term estimate didn't include a rate or occupancy." };
    }
    return { ok: true, cached: result.cached, estimate };
  } catch (error) {
    if (error instanceof AirRoiError && error.code === "not_configured") {
      return { ok: false, code: "not_configured", message: error.message };
    }
    const status = error instanceof AirRoiError ? error.status : undefined;
    if (status === 401 || status === 403) {
      return { ok: false, code: "upstream", message: "The short-term data service rejected the API key." };
    }
    if (status === 429) {
      return { ok: false, code: "upstream", message: "The short-term data service is limiting requests." };
    }
    return {
      ok: false,
      code: "upstream",
      message: "Short-term market data didn't load. The planning estimate is still here.",
    };
  }
}
