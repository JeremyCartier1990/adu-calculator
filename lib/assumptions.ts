/**
 * Home First Remodel — ADU calculator assumptions.
 *
 * This is the only file to edit when tuning the model. Costs are planning
 * ranges for Los Angeles in 2026, not a bid. The page labels every result
 * as an estimate and prints the rates it actually used.
 *
 * School fees, impact fees and utility connections are left out of the
 * estimate; city permits are the only fee line. Replace these
 * with the company's cost book when you have one.
 */

export type ProjectTypeId = "garage_conversion" | "attached_adu" | "detached_adu";
export type FinishLevelId = "eco" | "standard" | "premium";
export type BedroomCount = 0 | 1 | 2 | 3;

export const PROJECT_TYPES = [
  {
    id: "garage_conversion",
    title: "Garage conversion",
    text: "Turn an existing garage into living space. Usually the lowest cost, because the shell is already there.",
  },
  {
    id: "attached_adu",
    title: "Attached ADU",
    text: "A new suite that shares a wall with the house. A separate entrance, without a full backyard structure.",
  },
  {
    id: "detached_adu",
    title: "Detached ADU",
    text: "A backyard cottage with its own walls and utilities. The most privacy, and the highest cost.",
  },
] as const satisfies ReadonlyArray<{
  id: ProjectTypeId;
  title: string;
  text: string;
}>;

export const FINISH_LEVELS = [
  {
    id: "eco",
    title: "Eco",
    text: "Economy build: builder-grade finishes and a simple layout, for the lowest budget.",
  },
  {
    id: "standard",
    title: "Standard",
    text: "Durable finishes and an efficient kitchen and bath.",
  },
  {
    id: "premium",
    title: "Premium",
    text: "Upgraded cabinets, counters, tile, and windows.",
  },
] as const satisfies ReadonlyArray<{
  id: FinishLevelId;
  title: string;
  text: string;
}>;

/** Every new report opens on the eco finish, the lowest price; the homeowner can step up from there. */
export const OPENING_FINISH: FinishLevelId = "eco";

export const ASSUMPTIONS = {
  /**
   * The builder's costs, before markup. Construction, plans and permits are cost × markup;
   * finish materials are charged at cost. Only the final prices are shown. Rates are the same
   * for every ADU type.
   */
  cost: {
    markup: 1.6,
    buildPerSqft: { eco: 200, standard: 250, premium: 270 } as Record<FinishLevelId, number>,
    finishPerSqft: { eco: 50, standard: 80, premium: 150 } as Record<FinishLevelId, number>,
    /** Plans scale with size, from the smallest ADU to the largest. */
    plans: { min: 6000, max: 10000 },
    /** City permits run $2,000 to $5,000 by city; with no city table yet, the midpoint. */
    permit: 3500,
  },
  operations: {
    vacancyRate: 0.05,
    /** Stand-in for the added assessed value of the improvement. */
    propertyTaxRate: 0.012,
    rentGrowthRate: 0.03,
    /** Close to California's 2% assessed-value cap. */
    propertyTaxGrowthRate: 0.02,
    projectionYears: 15,
  },
  value: {
    /**
     * ADU area is not valued at 100% of the main home's price per square foot.
     * These factors keep the square-foot approach conservative.
     */
    sqftFactor: {
      garage_conversion: 0.55,
      attached_adu: 0.7,
      detached_adu: 0.75,
    },
    /** Used only when home size or home value is missing. */
    fallbackValuePerSqft: 800,
    capRate: 0.048,
    /** Remainder of the blend is the income approach (NOI / cap rate). */
    sqftApproachWeight: 0.6,
  },
  rent: {
    fallbackMonthlyPerSqft: { 0: 5.8, 1: 5.15, 2: 4.65, 3: 4.2 } as Record<BedroomCount, number>,
    /** Shown as a range around the planning rate when RentCast isn't used. */
    fallbackRange: 0.12,
    debounceMs: 800,
    /** Sizes snap to 50 sqft steps. */
    snapSqft: 50,
    /**
     * RentCast and AirROI are each asked once per address, about this unit;
     * other sizes are scaled from it with the planning rates' shape, so changing
     * the ADU size never buys a second lookup.
     */
    reference: { sqft: 800, bedrooms: 2 },
    bathrooms: 1,
    propertyType: "Apartment",
    compCount: 5,
    /**
     * Off so RentCast uses the ADU size we send. Left on, it can substitute
     * the existing house's square footage and bedroom count.
     */
    lookupSubjectAttributes: false,
  },
  /**
   * Short-term (nightly) rental. RentCast has no occupancy or nightly-rate
   * data, so this whole block is a planning model. Tune it here.
   *
   * Monthly gross = nightly rate × daysPerMonth × occupancy.
   * The default nightly rate is the long-term monthly rent divided by
   * daysPerMonth, then multiplied. That keeps the two scenarios tied to the
   * same home instead of inventing a second market study.
   */
  shortTerm: {
    daysPerMonth: 30.4,
    nightlyFromMonthlyMultiplier: 2.4,
    /** Used only when there is no long-term rent to scale from. */
    fallbackNightlyRate: { 0: 145, 1: 185, 2: 240, 3: 295 } as Record<BedroomCount, number>,
    /** Los Angeles planning default. The page lets the homeowner edit this. */
    defaultOccupancy: 0.65,
    occupancyMin: 0.2,
    occupancyMax: 0.95,
    /** Full-service short-term management. Long-term does not charge this. */
    managementRate: 0.15,
  },
  size: {
    min: 300,
    max: 1200,
    step: 10,
    defaults: {
      garage_conversion: 500,
      attached_adu: 600,
      detached_adu: 800,
    } as Record<ProjectTypeId, number>,
    /** Bedroom count is derived from the ADU size. */
    bedroomBreaks: { studioBelow: 450, oneBedBelow: 700, twoBedBelow: 1000 },
  },
  lot: {
    tightDetachedBelowSqft: 3500,
    largeGarageAboveSqft: 700,
  },
  cacheTtlMs: 24 * 60 * 60 * 1000,
} as const;

/** Short-term guest count for the ADU itself: a studio sleeps 2, otherwise two guests per bedroom. */
export function guestsForBedrooms(bedrooms: number): number {
  if (!Number.isFinite(bedrooms) || bedrooms <= 0) return 2;
  return Math.min(16, Math.max(1, Math.round(bedrooms) * 2));
}

export function bedroomsForSqft(sqft: number): BedroomCount {
  const breaks = ASSUMPTIONS.size.bedroomBreaks;
  if (sqft < breaks.studioBelow) return 0;
  if (sqft < breaks.oneBedBelow) return 1;
  if (sqft < breaks.twoBedBelow) return 2;
  return 3;
}

export function bedroomLabel(count: number): string {
  if (count <= 0) return "Studio";
  if (count === 1) return "1 bedroom";
  return `${count} bedrooms`;
}

export function snapSqft(sqft: number): number {
  const { min, max } = ASSUMPTIONS.size;
  const step = ASSUMPTIONS.rent.snapSqft;
  const clamped = Math.min(max, Math.max(min, sqft));
  const snapped = Math.round(clamped / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

export function projectTitle(id: ProjectTypeId): string {
  return PROJECT_TYPES.find((project) => project.id === id)?.title ?? id;
}

/** A saved finish as one we still offer: reports saved with the retired "luxury" level open as premium. */
export function normalizeFinish(value: unknown): FinishLevelId | null {
  if (value === "luxury") return "premium";
  return FINISH_LEVELS.some((finish) => finish.id === value) ? (value as FinishLevelId) : null;
}

export function finishTitle(id: FinishLevelId): string {
  return FINISH_LEVELS.find((finish) => finish.id === id)?.title ?? id;
}
