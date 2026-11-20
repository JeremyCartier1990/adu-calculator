import { ASSUMPTIONS, type FinishLevelId, type ProjectTypeId } from "./assumptions";
import type { EstimateInput, RentSource, RentalUse } from "./calculate";
import { cleanText } from "./lead";
import type { PropertyFinancials } from "./propertyreach";

/** Property facts the homeowner confirmed (or typed) before seeing the analysis. */
export type ConfirmedProperty = {
  address: string;
  squareFootage: number | null;
  lotSize: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
  homeValue: number | null;
  latitude: number | null;
  longitude: number | null;
  /** Where the facts came from, and which ones the homeowner changed. */
  source: "rentcast" | "manual";
  edited: string[];
};

/** What the homeowner picked in the calculator; the estimate is recomputed from this on the server. */
export type ReportInputs = EstimateInput;

export type ReportRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  /** Only when the homeowner asked for the PDF by email. */
  email: string | null;
  phone: string;
  phoneVerified: boolean;
  property: ConfirmedProperty;
  inputs: ReportInputs | null;
  /** Mortgage and equity from PropertyReach, for the team only; filled in shortly after the report is created. */
  financials: PropertyFinancials | null;
};

const PROJECTS = new Set<ProjectTypeId>(["garage_conversion", "attached_adu", "detached_adu"]);
const FINISHES = new Set<FinishLevelId>(["standard", "premium", "luxury"]);
const RENT_SOURCES = new Set<RentSource>(["rentcast", "assumption", "manual"]);
const FACT_KEYS = ["squareFootage", "lotSize", "bedrooms", "bathrooms", "yearBuilt", "propertyType", "homeValue"];

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** A finite number inside [min, max], or null when missing or out of range. */
function bounded(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

export function parseConfirmedProperty(input: unknown): ConfirmedProperty | null {
  const data = record(input);
  if (!data) return null;
  const address = typeof data.address === "string" ? cleanText(data.address, 160) : "";
  if (address.length < 8 || !/\d/.test(address) || !/\p{L}/u.test(address)) return null;
  const edited = Array.isArray(data.edited) ? data.edited.filter((key): key is string => FACT_KEYS.includes(key as string)) : [];
  return {
    address,
    squareFootage: bounded(data.squareFootage, 100, 50000),
    lotSize: bounded(data.lotSize, 100, 5000000),
    bedrooms: bounded(data.bedrooms, 0, 20),
    bathrooms: bounded(data.bathrooms, 0, 20),
    yearBuilt: bounded(data.yearBuilt, 1800, 2100),
    propertyType: typeof data.propertyType === "string" && data.propertyType ? cleanText(data.propertyType, 40) : null,
    homeValue: bounded(data.homeValue, 10000, 100000000),
    latitude: bounded(data.latitude, -90, 90),
    longitude: bounded(data.longitude, -180, 180),
    source: data.source === "rentcast" ? "rentcast" : "manual",
    edited,
  };
}

export function parseReportInputs(input: unknown): ReportInputs | null {
  const data = record(input);
  if (!data) return null;
  const projectType = data.projectType as ProjectTypeId;
  const finish = data.finish as FinishLevelId;
  const rentSource = data.rentSource as RentSource;
  if (!PROJECTS.has(projectType) || !FINISHES.has(finish) || !RENT_SOURCES.has(rentSource)) return null;
  const sqft = bounded(data.sqft, ASSUMPTIONS.size.min, ASSUMPTIONS.size.max);
  const monthlyRent = bounded(data.monthlyRent, 1, 100000);
  if (sqft == null || monthlyRent == null) return null;
  const rentalUse: RentalUse = data.rentalUse === "short_term" ? "short_term" : "long_term";
  return {
    projectType,
    finish,
    sqft,
    monthlyRent,
    rentLow: bounded(data.rentLow, 0, 100000),
    rentHigh: bounded(data.rentHigh, 0, 100000),
    rentSource,
    homeSquareFootage: bounded(data.homeSquareFootage, 100, 50000),
    homeValue: bounded(data.homeValue, 10000, 100000000),
    lotSize: bounded(data.lotSize, 100, 5000000),
    rentalUse,
    strOccupancy: bounded(data.strOccupancy, 0.05, 1),
    strNightlyRate: bounded(data.strNightlyRate, 1, 20000),
  };
}

/** Annual net income over all-in project cost. */
export function cashOnCash(annualNet: number, total: number): number | null {
  if (!(total > 0)) return null;
  return annualNet / total;
}

export function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}
