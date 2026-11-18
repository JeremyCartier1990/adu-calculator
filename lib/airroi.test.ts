import assert from "node:assert/strict";
import test from "node:test";
import {
  AirRoiError,
  buildAirRoiUrl,
  lookupShortTerm,
  monthlyDollars,
  parseAirRoiBody,
  resetAirRoiForTests,
} from "./airroi";

const fixture = {
  revenue: 50000,
  average_daily_rate: 200,
  occupancy: 0.68,
  currency: "USD",
  percentiles: {
    revenue: { p25: 40000, p50: 48000, p75: 55000, p90: 62000 },
    average_daily_rate: { p25: 170, p50: 195, p75: 220, p90: 250 },
    occupancy: { p25: 0.55, p50: 0.65, p75: 0.75, p90: 0.82 },
  },
  monthly_revenue_distributions: [0.05, 0.05, 0.07, 0.08, 0.09, 0.11, 0.13, 0.12, 0.1, 0.08, 0.06, 0.06],
  comparable_listings: [
    {
      listing_info: { listing_name: "Backyard cottage" },
      property_details: { bedrooms: 1 },
      performance_metrics: { ttm_revenue: 42000, ttm_avg_rate: 180, ttm_occupancy: 0.7 },
    },
    { name: "Second listing", revenue: 39000, adr: 160, occupancy: 0.6, bedrooms: 1 },
  ],
};

test("AirROI URL uses the documented estimate endpoint and auth is not in the query", () => {
  const url = new URL(buildAirRoiUrl({ latitude: 33.991, longitude: -118.4692, bedrooms: 2, baths: 1, guests: 4 }));
  assert.equal(url.origin + url.pathname, "https://api.airroi.com/calculator/estimate");
  assert.equal(url.searchParams.get("lat"), "33.9910");
  assert.equal(url.searchParams.get("lng"), "-118.4692");
  assert.equal(url.searchParams.get("bedrooms"), "2");
  assert.equal(url.searchParams.get("baths"), "1");
  assert.equal(url.searchParams.get("guests"), "4");
  assert.equal(url.searchParams.get("currency"), "usd");
  assert.equal(url.searchParams.get("room_type"), "entire_home");
  assert.equal(url.searchParams.get("X-API-KEY"), null);
});

test("parser reads ADR, occupancy, percentile bands, seasonality shares, and comps", () => {
  const parsed = parseAirRoiBody(fixture);
  assert.ok(parsed);
  if (!parsed) return;
  assert.equal(parsed.adr, 200);
  assert.equal(parsed.occupancy, 0.68);
  assert.equal(parsed.annualRevenue, 50000);
  assert.equal(parsed.monthlyRevenue, Math.round(50000 / 12));
  assert.equal(parsed.percentiles.revenue.p25, 40000);
  assert.equal(parsed.percentiles.adr.p90, 250);
  assert.equal(parsed.months[0]?.revenue, Math.round(50000 * 0.05));
  assert.equal(parsed.months[6]?.label, "Jul");
  assert.equal(parsed.compCount, 2);
  assert.equal(parsed.comps[0]?.name, "Backyard cottage");
  assert.equal(parsed.comps[0]?.revenue, 42000);
  assert.equal(parsed.comps[1]?.adr, 160);
});

test("dollar monthly series is kept when the values are not shares", () => {
  const months = monthlyDollars(12000, [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
  assert.equal(months[11]?.revenue, 1200);
});

test("a missing AirROI key never calls fetch", async () => {
  const previous = process.env.AIRROI_API_KEY;
  delete process.env.AIRROI_API_KEY;
  resetAirRoiForTests();
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  try {
    const result = await lookupShortTerm({ latitude: 34, longitude: -118, bedrooms: 1, baths: 1, guests: 2 });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "not_configured");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
    if (previous == null) delete process.env.AIRROI_API_KEY;
    else process.env.AIRROI_API_KEY = previous;
    resetAirRoiForTests();
  }
});

test("the second identical AirROI lookup is served from memory", async () => {
  const previous = process.env.AIRROI_API_KEY;
  process.env.AIRROI_API_KEY = "test-key";
  resetAirRoiForTests();
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    assert.equal(new Headers(init?.headers).get("X-API-KEY"), "test-key");
    return new Response(JSON.stringify(fixture), { status: 200 });
  }) as typeof fetch;
  try {
    const first = await lookupShortTerm({ latitude: 34.05224, longitude: -118.24368, bedrooms: 2, baths: 1, guests: 4 });
    const second = await lookupShortTerm({ latitude: 34.05224, longitude: -118.24368, bedrooms: 2, baths: 1, guests: 4 });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.cached, true);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
    if (previous == null) delete process.env.AIRROI_API_KEY;
    else process.env.AIRROI_API_KEY = previous;
    resetAirRoiForTests();
  }
});

test("AirRoiError is the not-configured type", () => {
  const error = new AirRoiError("not_configured", "missing");
  assert.equal(error.code, "not_configured");
});
