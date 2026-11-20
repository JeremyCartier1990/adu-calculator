import { normalizeAddress } from "./address";
import { ASSUMPTIONS, snapSqft } from "./assumptions";
import type { PropertyFacts, PropertyLookup, RentLookup, ValueFacts } from "./api-types";
import { scaleRent } from "./calculate";

export type { PropertyFacts, PropertyLookup, RentLookup, ValueFacts };

export class RentCastError extends Error {
  constructor(
    public code: "not_configured" | "not_found" | "upstream" | "bad_response",
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "RentCastError";
  }
}

export const RENTCAST_NOT_CONFIGURED_MESSAGE =
  "Live property data isn't connected right now. Enter the home's size, lot, and value, and edit the rent if you know it.";

export type RentCastPayload = { ok: true; body: unknown } | { ok: false; code: "not_found" };

type CacheEntry = { expires: number; value: RentCastPayload };
type Loader = (url: string) => Promise<RentCastPayload>;

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<RentCastPayload>>();
let persistentLoader: Loader | null = null;

export function setRentCastPersistentLoader(loader: Loader | null): void {
  persistentLoader = loader;
}

export function resetRentCastForTests(): void {
  memory.clear();
  inflight.clear();
  persistentLoader = null;
}

export function hasFreshRentCastCache(url: string): boolean {
  const hit = memory.get(url);
  return Boolean(hit && hit.expires > Date.now());
}

export function buildRentCastUrl(path: string, params: Record<string, string | number | boolean>): string {
  const url = new URL(`https://api.rentcast.io/v1${path}`);
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function propertyRequestUrls(address: string): { records: string; value: string } {
  const normalized = normalizeAddress(address);
  return {
    records: buildRentCastUrl("/properties", { address: normalized }),
    value: buildRentCastUrl("/avm/value", {
      address: normalized,
      compCount: ASSUMPTIONS.rent.compCount,
    }),
  };
}

/** The one rent query made per address, whatever size the homeowner picks. */
export function referenceRentUrl(address: string): string {
  const { sqft, bedrooms } = ASSUMPTIONS.rent.reference;
  return rentRequestUrl(address, sqft, bedrooms);
}

export function rentRequestUrl(address: string, squareFootage: number, bedrooms: number): string {
  return buildRentCastUrl("/avm/rent/long-term", {
    address: normalizeAddress(address),
    propertyType: ASSUMPTIONS.rent.propertyType,
    bedrooms,
    bathrooms: ASSUMPTIONS.rent.bathrooms,
    squareFootage: snapSqft(squareFootage),
    compCount: ASSUMPTIONS.rent.compCount,
    lookupSubjectAttributes: ASSUMPTIONS.rent.lookupSubjectAttributes,
  });
}

export async function requestRentCast(url: string): Promise<RentCastPayload> {
  const apiKey = process.env.RENTCAST_API_KEY?.trim();
  if (!apiKey) {
    throw new RentCastError("not_configured", RENTCAST_NOT_CONFIGURED_MESSAGE);
  }

  const pathname = new URL(url).pathname;
  console.info(JSON.stringify({ event: "rentcast_upstream", path: pathname }));

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Api-Key": apiKey,
    },
    cache: "no-store",
  });

  if (response.status === 404) return { ok: false, code: "not_found" };
  if (!response.ok) {
    throw new RentCastError("upstream", `RentCast request failed (${response.status}).`, response.status);
  }

  try {
    return { ok: true, body: await response.json() };
  } catch {
    throw new RentCastError("bad_response", "RentCast returned an unreadable response.", response.status);
  }
}

async function remember(url: string): Promise<{ payload: RentCastPayload; cached: boolean }> {
  const hit = memory.get(url);
  if (hit && hit.expires > Date.now()) {
    return { payload: hit.value, cached: true };
  }

  const pending = inflight.get(url);
  if (pending) return { payload: await pending, cached: true };

  const promise = (persistentLoader ? persistentLoader(url) : requestRentCast(url))
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

export async function rentCastGet(url: string): Promise<{ payload: RentCastPayload; cached: boolean }> {
  if (!process.env.RENTCAST_API_KEY?.trim()) {
    throw new RentCastError("not_configured", RENTCAST_NOT_CONFIGURED_MESSAGE);
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

function positive(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed == null || parsed <= 0) return null;
  return parsed;
}

function nonNegative(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed == null || parsed < 0) return null;
  return parsed;
}

function yearBuilt(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed == null || parsed < 1800 || parsed > 2035) return null;
  return Math.round(parsed);
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function readFacts(record: Record<string, unknown> | null): PropertyFacts {
  return {
    formattedAddress: text(record?.formattedAddress, 180),
    squareFootage: positive(record?.squareFootage),
    lotSize: positive(record?.lotSize),
    bedrooms: nonNegative(record?.bedrooms),
    bathrooms: positive(record?.bathrooms),
    yearBuilt: yearBuilt(record?.yearBuilt),
    propertyType: text(record?.propertyType, 80),
    latitude: coordinate(record?.latitude, -90, 90),
    longitude: coordinate(record?.longitude, -180, 180),
  };
}

function coordinate(value: unknown, min: number, max: number): number | null {
  const parsed = asNumber(value);
  if (parsed == null || parsed < min || parsed > max) return null;
  return parsed;
}

function firstRecord(body: unknown): Record<string, unknown> | null {
  if (Array.isArray(body)) return asRecord(body[0]);
  return asRecord(body);
}

function fillGaps(primary: PropertyFacts, fallback: PropertyFacts): PropertyFacts {
  return {
    formattedAddress: primary.formattedAddress ?? fallback.formattedAddress,
    squareFootage: primary.squareFootage ?? fallback.squareFootage,
    lotSize: primary.lotSize ?? fallback.lotSize,
    bedrooms: primary.bedrooms ?? fallback.bedrooms,
    bathrooms: primary.bathrooms ?? fallback.bathrooms,
    yearBuilt: primary.yearBuilt ?? fallback.yearBuilt,
    propertyType: primary.propertyType ?? fallback.propertyType,
    latitude: primary.latitude ?? fallback.latitude,
    longitude: primary.longitude ?? fallback.longitude,
  };
}

function hasAnyFact(facts: PropertyFacts): boolean {
  return Boolean(
    facts.squareFootage ||
      facts.lotSize ||
      facts.bedrooms != null ||
      facts.bathrooms ||
      facts.yearBuilt ||
      facts.propertyType,
  );
}

function upstreamMessage(error: unknown): string {
  if (error instanceof RentCastError) {
    if (error.status === 401 || error.status === 403) {
      return "The property service rejected the API key. Enter the details yourself.";
    }
    if (error.status === 429) {
      return "The property service is limiting requests. Wait a bit, or enter the details yourself.";
    }
    return "The property service didn't respond. Enter the details yourself.";
  }
  return "The property service didn't respond. Enter the details yourself.";
}

export async function lookupProperty(address: string): Promise<PropertyLookup> {
  const urls = propertyRequestUrls(address);
  const [recordsResult, valueResult] = await Promise.allSettled([
    rentCastGet(urls.records),
    rentCastGet(urls.value),
  ]);

  if (recordsResult.status === "rejected" && valueResult.status === "rejected") {
    const error = recordsResult.reason;
    if (error instanceof RentCastError && error.code === "not_configured") {
      return { ok: false, code: "not_configured", message: error.message };
    }
    return { ok: false, code: "upstream", message: upstreamMessage(error) };
  }

  const warnings: string[] = [];
  let cached = true;
  let recordsBody: unknown = null;
  let valueBody: unknown = null;

  if (recordsResult.status === "fulfilled") {
    cached &&= recordsResult.value.cached;
    if (recordsResult.value.payload.ok) recordsBody = recordsResult.value.payload.body;
    else warnings.push("No property record was found for that address.");
  } else {
    cached = false;
    warnings.push(upstreamMessage(recordsResult.reason));
  }

  if (valueResult.status === "fulfilled") {
    cached &&= valueResult.value.cached;
    if (valueResult.value.payload.ok) valueBody = valueResult.value.payload.body;
    else warnings.push("No value estimate was found for that address.");
  } else {
    cached = false;
    warnings.push(upstreamMessage(valueResult.reason));
  }

  const recordsMissing = recordsBody == null || (Array.isArray(recordsBody) && recordsBody.length === 0);
  const recordFacts = readFacts(recordsMissing ? null : firstRecord(recordsBody));
  const valueRecord = asRecord(valueBody);
  const subjectFacts = readFacts(asRecord(valueRecord?.subjectProperty));
  const property = fillGaps(recordFacts, subjectFacts);
  const value: ValueFacts = {
    price: positive(valueRecord?.price),
    priceRangeLow: positive(valueRecord?.priceRangeLow),
    priceRangeHigh: positive(valueRecord?.priceRangeHigh),
  };

  if (!hasAnyFact(property) && value.price == null) {
    return {
      ok: false,
      code: "not_found",
      message: "We couldn't find that address. Check the spelling, or enter the details yourself.",
    };
  }

  if (recordsMissing && hasAnyFact(subjectFacts)) {
    warnings.push("Property records were missing, so some facts come from the valuation.");
  }
  if (property.squareFootage == null || property.lotSize == null) {
    warnings.push("Some facts were missing. Fill in anything you know.");
  }

  return {
    ok: true,
    cached,
    formattedAddress: property.formattedAddress,
    property,
    value,
    warnings,
  };
}

export async function lookupRent(
  address: string,
  squareFootage: number,
  bedrooms: number,
): Promise<RentLookup> {
  const snapped = snapSqft(squareFootage);
  const beds = Math.min(3, Math.max(0, Math.round(bedrooms)));
  const reference = ASSUMPTIONS.rent.reference;
  const url = referenceRentUrl(address);

  let result: { payload: RentCastPayload; cached: boolean };
  try {
    result = await rentCastGet(url);
  } catch (error) {
    if (error instanceof RentCastError && error.code === "not_configured") {
      return { ok: false, code: "not_configured", message: error.message };
    }
    return { ok: false, code: "upstream", message: upstreamMessage(error) };
  }

  if (!result.payload.ok) {
    return {
      ok: false,
      code: "not_found",
      message: "No rent estimate came back for that ADU size. Enter a monthly rent yourself.",
    };
  }

  const body = asRecord(result.payload.body);
  const rent = positive(body?.rent);
  if (rent == null) {
    return {
      ok: false,
      code: "upstream",
      message: "The rent estimate didn't include a rent figure. Enter one yourself.",
    };
  }

  const low = positive(body?.rentRangeLow);
  const high = positive(body?.rentRangeHigh);
  const target = { sqft: snapped, bedrooms: beds };
  return {
    ok: true,
    cached: result.cached,
    rent: scaleRent(rent, reference, target),
    rentRangeLow: low == null ? null : scaleRent(low, reference, target),
    rentRangeHigh: high == null ? null : scaleRent(high, reference, target),
    squareFootage: snapped,
    bedrooms: beds,
    reference: { ...reference, rent: Math.round(rent), rentRangeLow: low, rentRangeHigh: high },
  };
}
