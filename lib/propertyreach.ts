// PropertyReach (https://docs.propertyreach.com): property facts, plus owner,
// mortgage and equity data. One successful lookup costs one API credit, so
// responses are cached: the confirm step and the lead's financials share one call.

import type { PropertyFacts, PropertyLookup, ValueFacts } from "./api-types";

const ENDPOINT = "https://api.propertyreach.com/v1/property";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Lenders typically fund a home equity line up to this combined loan-to-value.
const HELOC_MAX_CLTV = 0.8;

export type MortgageLoan = {
  lender: string | null;
  loanType: string | null;
  rateType: string | null;
  /** Annual rate as a fraction, e.g. 0.0538. */
  rate: number | null;
  amount: number | null;
  estimatedBalance: number | null;
  estimatedPayment: number | null;
  termMonths: number | null;
  recordingDate: string | null;
};

export type PropertyFinancials = {
  source: "propertyreach";
  fetchedAt: string;
  estimatedValue: number | null;
  estimatedEquity: number | null;
  /** Loan balance ÷ estimated value. */
  loanToValue: number | null;
  loanBalance: number | null;
  monthlyPayment: number | null;
  openLoanCount: number;
  /** Equity a lender could open as a credit line at 80% combined loan-to-value. */
  helocCapacity: number | null;
  ownerOccupied: boolean | null;
  ownerNames: string | null;
  lastSaleAmount: number | null;
  lastSaleDate: string | null;
  annualTax: number | null;
  loans: MortgageLoan[];
};

type Address = { streetAddress: string; city: string; state: string; zip?: string };

/** "2543 Walnut Ave, Venice, CA 90291, USA" → its parts; null when it doesn't look like a US street address. */
export function splitUsAddress(address: string): Address | null {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length && /^(usa|united states)$/i.test(parts.at(-1)!)) parts.pop();
  if (parts.length < 3) return null;
  const match = parts.at(-1)!.match(/^([A-Za-z]{2})(?:\s+(\d{5})(?:-\d{4})?)?$/);
  if (!match) return null;
  return {
    streetAddress: parts.slice(0, -2).join(", "),
    city: parts.at(-2)!,
    state: match[1].toUpperCase(),
    ...(match[2] ? { zip: match[2] } : {}),
  };
}

export function propertyReachUrl(address: string, latitude: number | null, longitude: number | null): string | null {
  const url = new URL(ENDPOINT);
  const parts = splitUsAddress(address);
  if (parts) {
    for (const [key, value] of Object.entries(parts)) url.searchParams.set(key, value);
  } else if (latitude != null && longitude != null) {
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
  } else {
    return null;
  }
  return url.toString();
}

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

/** Keep only the fields the team uses from a Property Details response. */
export function parsePropertyReach(body: unknown, fetchedAt = new Date().toISOString()): PropertyFinancials | null {
  const property = (body as { property?: unknown } | null)?.property;
  if (!property || typeof property !== "object") return null;
  const p = property as Record<string, unknown>;
  const loans: MortgageLoan[] = (Array.isArray(p.openLoans) ? p.openLoans : [])
    .filter((loan): loan is Record<string, unknown> => Boolean(loan) && typeof loan === "object")
    .filter((loan) => loan.active !== false)
    .map((loan) => ({
      lender: text(loan.lenderName),
      loanType: text(loan.loanType),
      rateType: text(loan.rateType),
      rate: num(loan.rate),
      amount: num(loan.amount),
      estimatedBalance: num(loan.estimatedBalance),
      estimatedPayment: num(loan.estimatedPayment),
      termMonths: num(loan.term),
      recordingDate: text(loan.recordingDate),
    }));
  const estimatedValue = num(p.estimatedValue);
  const loanBalance = num(p.loanBalance) ?? (loans.length ? loans.reduce((sum, loan) => sum + (loan.estimatedBalance ?? 0), 0) : 0);
  return {
    source: "propertyreach",
    fetchedAt,
    estimatedValue,
    estimatedEquity: num(p.estimatedEquity),
    loanToValue: num(p.loanToValueRatio),
    loanBalance,
    monthlyPayment: num(p.loanPaymentAmount),
    openLoanCount: num(p.openLoanCount) ?? loans.length,
    helocCapacity: estimatedValue == null ? null : Math.max(0, Math.round(estimatedValue * HELOC_MAX_CLTV - (loanBalance ?? 0))),
    ownerOccupied: typeof p.ownerOccupied === "boolean" ? p.ownerOccupied : null,
    ownerNames: text(p.ownerNames),
    lastSaleAmount: num(p.lastSaleAmount),
    lastSaleDate: text(p.lastSaleDate),
    annualTax: num(p.taxAmount),
    loans,
  };
}

export function propertyReachConfigured(): boolean {
  return Boolean(process.env.PROPERTYREACH_API_KEY?.trim());
}

type Body = { meta?: { resultCount?: number }; property?: Record<string, unknown> };
const cache = new Map<string, { expires: number; body: Body | null }>();

export function resetPropertyReachForTests(): void {
  cache.clear();
}

/** The Property Details body for an address: memory, then the permanent store, then one paid call. Null when unconfigured or unmatched, "failed" on an outage. */
async function propertyDetails(address: string, latitude: number | null, longitude: number | null): Promise<Body | null | "failed"> {
  const key = process.env.PROPERTYREACH_API_KEY?.trim();
  const url = propertyReachUrl(address, latitude, longitude);
  if (!key || !url) return null;
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.body;

  const body = await loadDetails(url).catch(() => "failed" as const);
  // Outages aren't cached, so the next lookup tries again.
  if (body !== "failed") cache.set(url, { expires: Date.now() + CACHE_TTL_MS, body });
  return body;
}

let loadDetails = (url: string): Promise<Body | null> => requestPropertyReach(url);

/** Route the paid call through a persistent store (lib/partner-store.ts on the server). */
export function setPropertyReachLoader(loader: (url: string, request: (url: string) => Promise<Body | null>) => Promise<Body | null>) {
  loadDetails = (url) => loader(url, requestPropertyReach);
}

/** One paid Property Details call. Resolves null when nothing matched; throws on an outage. */
async function requestPropertyReach(url: string): Promise<Body | null> {
  const response = await fetch(url, {
    headers: { "x-api-key": process.env.PROPERTYREACH_API_KEY?.trim() ?? "", Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch((error: unknown) => {
    console.error(JSON.stringify({ event: "propertyreach_error", error: String(error) }));
    return null;
  });
  console.info(JSON.stringify({ event: "propertyreach_upstream", status: response?.status ?? null }));
  if (!response || (!response.ok && response.status !== 404)) throw new Error(`PropertyReach failed (${response?.status ?? "network"})`);
  const body = response.ok ? ((await response.json().catch(() => null)) as Body | null) : null;
  return body?.property && body.meta?.resultCount !== 0 ? body : null;
}

const positive = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null);

/** Confirm-step facts from a Property Details body. */
export function parsePropertyReachFacts(body: unknown): { property: PropertyFacts; value: ValueFacts } | null {
  const p = (body as Body | null)?.property;
  if (!p) return null;
  const street = text(p.streetAddress);
  const city = text(p.city);
  const state = text(p.state);
  const zip = text(p.zip);
  const formattedAddress = street && city && state ? `${street}, ${city}, ${state}${zip ? ` ${zip}` : ""}` : null;
  return {
    property: {
      formattedAddress,
      squareFootage: positive(p.livingSquareFeet) ?? positive(p.squareFeet),
      lotSize: positive(p.lotSquareFeet),
      bedrooms: positive(p.bedrooms),
      bathrooms: positive(p.bathrooms),
      yearBuilt: positive(p.yearBuilt),
      propertyType: text(p.propertyType),
      latitude: num(p.latitude),
      longitude: num(p.longitude),
    },
    value: { price: positive(p.estimatedValue), priceRangeLow: null, priceRangeHigh: null },
  };
}

/** Confirm-step lookup through PropertyReach, shaped like the RentCast lookup. */
export async function lookupPropertyReach(address: string): Promise<PropertyLookup> {
  if (!propertyReachConfigured()) {
    return { ok: false, code: "not_configured", message: "Property records aren't connected." };
  }
  const body = await propertyDetails(address, null, null);
  if (body === "failed") {
    return { ok: false, code: "upstream", message: "Property records aren't available right now. Fill in what you know." };
  }
  const facts = parsePropertyReachFacts(body);
  if (!facts) {
    return { ok: false, code: "not_found", message: "We couldn't find that address. Check the spelling, or enter the details yourself." };
  }
  const warnings =
    facts.property.squareFootage == null || facts.property.lotSize == null ? ["Some facts were missing. Fill in anything you know."] : [];
  return { ok: true, cached: false, formattedAddress: facts.property.formattedAddress, ...facts, warnings };
}

/** Look up a property's mortgage and equity. Null when the key is missing, nothing matched, or the API failed. */
export async function fetchPropertyFinancials(
  address: string,
  latitude: number | null,
  longitude: number | null,
): Promise<PropertyFinancials | null> {
  // Same address string as the confirm step, so a lookup made there is reused.
  const body = await propertyDetails(address, latitude, longitude);
  return body === "failed" ? null : parsePropertyReach(body);
}
