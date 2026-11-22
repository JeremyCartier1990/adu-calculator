import { ASSUMPTIONS, bedroomsForSqft, OPENING_FINISH, type FinishLevelId, type ProjectTypeId } from "./assumptions";
import { calculateEstimate, fallbackMonthlyRent } from "./calculate";

/**
 * Picks the setup a new report opens on: a size most lots can actually fit
 * (500 to 800 sqft, scaled to the lot), then the ADU type with the best
 * 10-year return at that size. Garage conversions are left out because public
 * records don't say whether there is a garage.
 */

export type PropertySize = { homeSquareFootage: number | null; homeValue: number | null; lotSize: number | null };
export type Setup = { projectType: ProjectTypeId; finish: FinishLevelId; sqft: number };

/** Gains are counted over this many years: value added − cost, plus the long-term rent kept. */
export const BEST_SETUP_YEARS = 10;
const FINISH = OPENING_FINISH;

/**
 * Largest ADU the state lets you build here (Gov. Code §66314 and §66321):
 * detached up to 1,200 sqft, 800 on a tight lot; attached up to half the home,
 * never less than 850 sqft and never more than 1,200.
 */
export function maxSqftFor(projectType: ProjectTypeId, property: PropertySize): number {
  const { max } = ASSUMPTIONS.size;
  if (projectType === "detached_adu") {
    const tight = property.lotSize != null && property.lotSize > 0 && property.lotSize < ASSUMPTIONS.lot.tightDetachedBelowSqft;
    return tight ? 800 : max;
  }
  if (projectType === "attached_adu") {
    const half = property.homeSquareFootage != null && property.homeSquareFootage > 0 ? property.homeSquareFootage / 2 : 0;
    return Math.min(max, Math.max(850, Math.floor(half / ASSUMPTIONS.size.step) * ASSUMPTIONS.size.step));
  }
  return ASSUMPTIONS.lot.largeGarageAboveSqft;
}

/** Value added − cost, plus the first ten years of long-term net rent, using planning rents so sizes compare fairly. */
export function setupGain(setup: Setup, property: PropertySize): number {
  const rent = fallbackMonthlyRent(setup.sqft, bedroomsForSqft(setup.sqft));
  const estimate = calculateEstimate({
    ...setup,
    monthlyRent: rent,
    rentLow: null,
    rentHigh: null,
    rentSource: "assumption",
    homeSquareFootage: property.homeSquareFootage,
    homeValue: property.homeValue,
    lotSize: property.lotSize,
  });
  const rentKept = estimate.scenarios.longTerm.series.slice(1, BEST_SETUP_YEARS + 1).reduce((sum, point) => sum + point.net, 0);
  return estimate.equity + rentKept;
}

/** The opening size stays in the range most backyards fit, whatever the state would allow. */
export const SUGGESTED_SQFT = { min: 500, max: 800, unknownLot: 600 };
/** About an eighth of the lot: 4,000 sqft → 500, 5,000 → 600, 6,000 → 700, 6,500 and up → 800. */
const LOT_SHARE = 0.12;

/** A size that makes sense for the lot, rounded to 50 sqft, between 500 and 800. */
export function suggestedSqft(lotSize: number | null): number {
  if (lotSize == null || lotSize <= 0) return SUGGESTED_SQFT.unknownLot;
  const sized = Math.round((lotSize * LOT_SHARE) / 50) * 50;
  return Math.min(SUGGESTED_SQFT.max, Math.max(SUGGESTED_SQFT.min, sized));
}

/** A typical two-car garage; most conversions are about this size. */
const GARAGE_SQFT = 400;

/**
 * What a new report opens on: the ADU type the homeowner said they want, at a size that
 * fits the lot, or the best setup when they aren't sure yet.
 */
export function openingSetup(property: PropertySize, interest: ProjectTypeId | null | undefined): Setup {
  if (!interest) return bestSetup(property);
  const sqft = interest === "garage_conversion" ? GARAGE_SQFT : Math.min(suggestedSqft(property.lotSize), maxSqftFor(interest, property));
  return { projectType: interest, finish: FINISH, sqft };
}

export function bestSetup(property: PropertySize): Setup {
  const target = suggestedSqft(property.lotSize);
  let best: Setup = { projectType: "detached_adu", finish: FINISH, sqft: target };
  let bestGain = -Infinity;
  for (const projectType of ["detached_adu", "attached_adu"] as const) {
    const setup = { projectType, finish: FINISH, sqft: Math.min(target, maxSqftFor(projectType, property)) };
    const gain = setupGain(setup, property);
    if (gain > bestGain) [best, bestGain] = [setup, gain];
  }
  return best;
}
