import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_ADDRESS } from "./sample-home";
import {
  hasFreshRentCastCache,
  lookupProperty,
  lookupRent,
  propertyRequestUrls,
  rentRequestUrl,
  resetRentCastForTests,
} from "./rentcast";

const propertyRecord = {
  formattedAddress: "4 Ozone Ave, Venice, CA 90291",
  squareFootage: 1180,
  lotSize: 2700,
  bedrooms: 2,
  bathrooms: 1,
  yearBuilt: 1924,
  propertyType: "Single Family",
};

const valueRecord = {
  price: 1_850_000,
  priceRangeLow: 1_700_000,
  priceRangeHigh: 2_000_000,
  subjectProperty: {
    formattedAddress: "4 Ozone Ave, Venice, CA 90291",
    squareFootage: 1180,
    lotSize: 2700,
  },
};

function header(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

test("sample address builds the RentCast property, value, and rent URLs", () => {
  const urls = propertyRequestUrls(SAMPLE_ADDRESS);
  const records = new URL(urls.records);
  const value = new URL(urls.value);
  const rent = new URL(rentRequestUrl("4  Ozone Ave, Venice, CA 90291", 824, 2));

  assert.equal(records.origin + records.pathname, "https://api.rentcast.io/v1/properties");
  assert.equal(records.searchParams.get("address"), "4 ozone ave, venice, ca 90291");
  assert.equal(value.pathname, "/v1/avm/value");
  assert.equal(value.searchParams.get("compCount"), "5");
  assert.equal(rent.pathname, "/v1/avm/rent/long-term");
  assert.equal(rent.searchParams.get("propertyType"), "Apartment");
  assert.equal(rent.searchParams.get("bedrooms"), "2");
  assert.equal(rent.searchParams.get("bathrooms"), "1");
  assert.equal(rent.searchParams.get("squareFootage"), "800");
  assert.equal(rent.searchParams.get("compCount"), "5");
  assert.equal(rent.searchParams.get("lookupSubjectAttributes"), "false");
  assert.equal(rent.searchParams.get("address"), "4 ozone ave, venice, ca 90291");
});

test("lookup merges records and value, then serves the second call from memory", async () => {
  const previous = process.env.RENTCAST_API_KEY;
  process.env.RENTCAST_API_KEY = "test-key";
  resetRentCastForTests();
  const calls: string[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = String(input);
    calls.push(href);
    assert.equal(header(init, "X-Api-Key"), "test-key");
    assert.equal(header(init, "Accept"), "application/json");
    if (href.includes("/properties?")) {
      return new Response(JSON.stringify([propertyRecord]), { status: 200 });
    }
    if (href.includes("/avm/value?")) {
      return new Response(JSON.stringify(valueRecord), { status: 200 });
    }
    return new Response("nope", { status: 500 });
  }) as typeof fetch;

  try {
    const first = await lookupProperty(SAMPLE_ADDRESS);
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.cached, false);
      assert.equal(first.property.squareFootage, 1180);
      assert.equal(first.property.bedrooms, 2);
      assert.equal(first.value.price, 1_850_000);
      assert.equal(first.value.priceRangeHigh, 2_000_000);
    }
    assert.equal(calls.length, 2);

    const second = await lookupProperty("4   OZONE AVE, Venice, CA 90291");
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.cached, true);
    assert.equal(calls.length, 2);
    assert.equal(hasFreshRentCastCache(propertyRequestUrls(SAMPLE_ADDRESS).records), true);
  } finally {
    globalThis.fetch = original;
    if (previous == null) delete process.env.RENTCAST_API_KEY;
    else process.env.RENTCAST_API_KEY = previous;
    resetRentCastForTests();
  }
});

test("a missing API key never calls fetch", async () => {
  const previous = process.env.RENTCAST_API_KEY;
  delete process.env.RENTCAST_API_KEY;
  resetRentCastForTests();
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  try {
    const result = await lookupProperty(SAMPLE_ADDRESS);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "not_configured");
    const rent = await lookupRent(SAMPLE_ADDRESS, 800, 2);
    assert.equal(rent.ok, false);
    if (!rent.ok) assert.equal(rent.code, "not_configured");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
    if (previous == null) delete process.env.RENTCAST_API_KEY;
    else process.env.RENTCAST_API_KEY = previous;
    resetRentCastForTests();
  }
});

test("rent lookup reads the AVM and fills gaps from the subject property", async () => {
  const previous = process.env.RENTCAST_API_KEY;
  process.env.RENTCAST_API_KEY = "test-key";
  resetRentCastForTests();
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const href = String(input);
    if (href.includes("/properties?")) return new Response(JSON.stringify([]), { status: 200 });
    if (href.includes("/avm/value?")) {
      return new Response(
        JSON.stringify({
          price: 900000,
          subjectProperty: { squareFootage: 900, bedrooms: 2, bathrooms: 1, yearBuilt: 1950 },
        }),
        { status: 200 },
      );
    }
    if (href.includes("/avm/rent/long-term?")) {
      return new Response(
        JSON.stringify({ rent: 4100, rentRangeLow: 3800, rentRangeHigh: 4400 }),
        { status: 200 },
      );
    }
    return new Response("missing", { status: 404 });
  }) as typeof fetch;

  try {
    const property = await lookupProperty(SAMPLE_ADDRESS);
    assert.equal(property.ok, true);
    if (property.ok) {
      assert.equal(property.property.squareFootage, 900);
      assert.equal(property.value.price, 900000);
      assert.match(property.warnings.join(" "), /valuation/);
    }
    const rent = await lookupRent(SAMPLE_ADDRESS, 790, 2);
    assert.equal(rent.ok, true);
    if (rent.ok) {
      assert.equal(rent.rent, 4100);
      assert.equal(rent.squareFootage, 800);
      assert.equal(rent.rentRangeLow, 3800);
    }
  } finally {
    globalThis.fetch = original;
    if (previous == null) delete process.env.RENTCAST_API_KEY;
    else process.env.RENTCAST_API_KEY = previous;
    resetRentCastForTests();
  }
});
