import { ASSUMPTIONS, bedroomsForSqft, type FinishLevelId, type ProjectTypeId } from "./assumptions";
import { calculateEstimate, fallbackMonthlyRent } from "./calculate";

/**
 * Picks the setup a new report opens on: the ADU type and size with the best
 * 10-year return, inside California's size rules. Garage conversions are left
 * out because public records don't say whether there is a garage.
 */

export type PropertySize = { homeSquareFootage: number | null; homeValue: number | null; lotSize: number | null };
export type Setup = { projectType: ProjectTypeId; finish: FinishLevelId; sqft: number };

/** Gains are counted over this many years: value added − cost, plus the long-term rent kept. */
export const BEST_SETUP_YEARS = 10;
/** Finish doesn't change rent in the model, so the cheapest would always win; standard is the honest middle. */
const FINISH: FinishLevelId = "standard";

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

export function bestSetup(property: PropertySize): Setup {
  const { min, step } = ASSUMPTIONS.size;
  let best: Setup = { projectType: "detached_adu", finish: FINISH, sqft: ASSUMPTIONS.size.defaults.detached_adu };
  let bestGain = -Infinity;
  for (const projectType of ["detached_adu", "attached_adu"] as const) {
    const max = maxSqftFor(projectType, property);
    for (let sqft = min; sqft <= max; sqft += step) {
      const setup = { projectType, finish: FINISH, sqft };
      const gain = setupGain(setup, property);
      if (gain > bestGain) [best, bestGain] = [setup, gain];
    }
  }
  return best;
}
