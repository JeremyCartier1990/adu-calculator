/**
 * Home First Remodel — ADU calculator assumptions.
 *
 * This is the only file to edit when tuning the model. Costs are planning
 * ranges for Los Angeles in 2026, not a bid. The page labels every result
 * as an estimate and prints the rates it actually used.
 *
 * California impact-fee note: state law generally prohibits ADU impact fees
 * under 750 sqft (Gov. Code § 65852.2). The school-fee line follows that
 * cutoff. City permit and utility allowances still apply. Replace these
 * with the company's cost book when you have one.
 */

export type ProjectTypeId = "garage_conversion" | "attached_adu" | "detached_adu";
export type FinishLevelId = "standard" | "premium" | "luxury";
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
    id: "standard",
    title: "Standard",
    text: "Durable finishes and an efficient kitchen and bath.",
  },
  {
    id: "premium",
    title: "Premium",
    text: "Upgraded cabinets, counters, tile, and windows.",
  },
  {
    id: "luxury",
    title: "Luxury",
    text: "Custom details, high-end fixtures, and designer finishes.",
  },
] as const satisfies ReadonlyArray<{
  id: FinishLevelId;
  title: string;
  text: string;
}>;

export const ASSUMPTIONS = {
  /** Hard construction only. Design, permits, and utilities are separate lines. */
  costPerSqft: {
    garage_conversion: { standard: 265, premium: 345, luxury: 440 },
    attached_adu: { standard: 360, premium: 455, luxury: 575 },
    detached_adu: { standard: 430, premium: 540, luxury: 680 },
  },
  design: {
    standard: { base: 4000, perSqft: 7 },
    premium: { base: 7500, perSqft: 12 },
    luxury: { base: 12000, perSqft: 20 },
  },
  permits: {
    impactFeeExemptBelowSqft: 750,
    cityPermitBase: 5800,
    cityPermitPerSqft: 4,
    /** Charged on the full ADU size once the project reaches the cutoff. */
    schoolFeePerSqft: 4.25,
    utilityConnection: {
      garage_conversion: 4000,
      attached_adu: 8500,
      detached_adu: 14000,
    },
  },
  operations: {
    vacancyRate: 0.05,
    /** Share of that year's gross rent, so it moves with rent. */
    maintenanceRate: 0.07,
    insurancePerSqftYear: 0.95,
    /** Stand-in for the added assessed value of the improvement. */
    propertyTaxRate: 0.012,
    rentGrowthRate: 0.03,
    expenseGrowthRate: 0.025,
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
    /** One RentCast rent call per 50 sqft step, not per slider tick. */
    snapSqft: 50,
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
    /** Used to turn occupied nights into cleaning visits. */
    averageStayNights: 3,
    /** Host-paid platform and payment fees, as a share of gross. */
    platformFeeRate: 0.15,
    /** Full-service short-term management. Long-term does not charge this. */
    managementRate: 0.2,
    /** Repairs, separate from turnover cleaning. */
    maintenanceRate: 0.03,
    cleaningPerTurnover: { 0: 120, 1: 160, 2: 210, 3: 270 } as Record<BedroomCount, number>,
    suppliesPerTurnover: 35,
    /** Host pays utilities while the ADU is occupied. */
    utilitiesPerOccupiedNight: 14,
    /** Short-term policies cost more than a standard landlord policy. */
    insurancePerSqftYear: 1.45,
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

export function finishTitle(id: FinishLevelId): string {
  return FINISH_LEVELS.find((finish) => finish.id === id)?.title ?? id;
}
