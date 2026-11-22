import assert from "node:assert/strict";
import test from "node:test";
import { ASSUMPTIONS, bedroomsForSqft, normalizeFinish, snapSqft } from "./assumptions";
import {
  calculateEstimate,
  clampOccupancy,
  constructionPrices,
  plansPrice,
  deriveNightlyRate,
  fallbackMonthlyRent,
  scaleNightlyRate,
  scaleRent,
  shortTermMonthlyGross,
  type EstimateInput,
} from "./calculate";

function input(overrides: Partial<EstimateInput> = {}): EstimateInput {
  return {
    projectType: "garage_conversion",
    finish: "standard",
    sqft: 400,
    monthlyRent: 2300,
    rentLow: 2000,
    rentHigh: 2600,
    rentSource: "assumption",
    homeSquareFootage: 2000,
    homeValue: 1_000_000,
    lotSize: 5000,
    ...overrides,
  };
}

test("bedroom count follows size breaks", () => {
  assert.equal(bedroomsForSqft(449), 0);
  assert.equal(bedroomsForSqft(450), 1);
  assert.equal(bedroomsForSqft(699), 1);
  assert.equal(bedroomsForSqft(700), 2);
  assert.equal(bedroomsForSqft(999), 2);
  assert.equal(bedroomsForSqft(1000), 3);
});

test("rent lookups snap to 50 sqft buckets inside the slider", () => {
  assert.equal(snapSqft(424), 400);
  assert.equal(snapSqft(425), 450);
  assert.equal(snapSqft(300), 300);
  assert.equal(snapSqft(1200), 1200);
  assert.equal(snapSqft(50), 300);
  assert.equal(snapSqft(5000), 1200);
});

test("construction, plans and permits carry the 1.6 markup; finish materials are at cost", () => {
  assert.equal(ASSUMPTIONS.cost.markup, 1.6, "Update this test in the same edit if you retune assumptions.ts");
  const estimate = calculateEstimate(input({ sqft: 700, finish: "standard" }));
  // $250 build × 1.6 = $400 per sqft; $80 finish materials at cost
  assert.equal(estimate.construction, 700 * 400);
  assert.equal(estimate.materials, 700 * 80);
  assert.equal(estimate.cityFees, 3500 * 1.6);
  assert.equal(estimate.total, estimate.construction + estimate.materials + estimate.design + estimate.cityFees);
  assert.equal(constructionPrices("eco").perSqft, 200 * 1.6 + 50);
  assert.equal(constructionPrices("premium").perSqft, 270 * 1.6 + 150);
  assert.match(estimate.notes.join(" "), /construction is \$400 per square foot and finish materials are \$80/);
});

test("plans run $6,000 to $10,000 in cost by size, before markup", () => {
  assert.equal(plansPrice(300), 6000 * 1.6);
  assert.equal(plansPrice(1200), 10000 * 1.6);
  assert.equal(plansPrice(750), 8000 * 1.6);
  assert.equal(plansPrice(5000), 10000 * 1.6);
});

test("construction cost is the same for every ADU type", () => {
  const garage = calculateEstimate(input({ projectType: "garage_conversion" }));
  const detached = calculateEstimate(input({ projectType: "detached_adu" }));
  assert.equal(garage.total, detached.total);
});

test("detached ADU on a small lot warns, and a large garage does too", () => {
  const tight = calculateEstimate(
    input({ projectType: "detached_adu", sqft: 800, finish: "premium", lotSize: 2700 }),
  );
  assert.match(tight.warnings.join(" "), /tight for a detached cottage/);
  const barn = calculateEstimate(input({ projectType: "garage_conversion", sqft: 800 }));
  assert.match(barn.warnings.join(" "), /not a straight garage conversion/);
});

test("missing home value uses the fallback price per square foot", () => {
  const estimate = calculateEstimate(input({ homeValue: null, homeSquareFootage: null }));
  assert.equal(estimate.usedFallbackValuePerSqft, true);
  assert.equal(estimate.valuePerSqft, ASSUMPTIONS.value.fallbackValuePerSqft);
  assert.equal(estimate.newHomeValue, null);
  assert.equal(
    estimate.sqftUplift,
    Math.round(800 * 400 * ASSUMPTIONS.value.sqftFactor.garage_conversion),
  );
});

test("payback is finite when income is positive and empty when rent is zero", () => {
  const estimate = calculateEstimate(input());
  assert.ok(estimate.annualNet > 0);
  assert.ok(
    estimate.simplePaybackYears != null &&
      estimate.breakEvenYears != null &&
      estimate.simplePaybackYears > 0 &&
      estimate.breakEvenYears > 0 &&
      estimate.breakEvenYears <= estimate.simplePaybackYears,
  );
  assert.equal(estimate.series[0]?.cumulative, -estimate.total);
  assert.equal(estimate.series.length, 16);
  assert.equal(
    estimate.series[1]?.cumulative,
    -estimate.total + estimate.yearOne.net,
  );

  const empty = calculateEstimate(input({ monthlyRent: 0 }));
  assert.ok(empty.annualNet <= 0);
  assert.equal(empty.breakEvenYears, null);
  assert.equal(empty.incomeUplift, null);
  assert.equal(empty.blendedUplift, empty.sqftUplift);
});

test("fallback rent depends on size and derived bedrooms", () => {
  assert.equal(fallbackMonthlyRent(500, 1), Math.round(500 * 5.15));
  assert.equal(fallbackMonthlyRent(800, 2), Math.round(800 * 4.65));
});

test("short-term gross is nightly rate times 30.4 times occupancy", () => {
  assert.equal(ASSUMPTIONS.shortTerm.daysPerMonth, 30.4);
  assert.equal(ASSUMPTIONS.shortTerm.defaultOccupancy, 0.65);
  assert.equal(deriveNightlyRate(3040, 2), 240);
  assert.equal(shortTermMonthlyGross(240, 0.65), Math.round(240 * 30.4 * 0.65));
  assert.equal(deriveNightlyRate(0, 2), ASSUMPTIONS.shortTerm.fallbackNightlyRate[2]);
  assert.equal(clampOccupancy(0.1), ASSUMPTIONS.shortTerm.occupancyMin);
  assert.equal(clampOccupancy(0.99), ASSUMPTIONS.shortTerm.occupancyMax);
});

test("short-term expenses come out of nightly revenue and do not call for a second rent", () => {
  const estimate = calculateEstimate(
    input({ monthlyRent: 3040, rentalUse: "short_term", strOccupancy: 0.65 }),
  );
  const str = estimate.scenarios.shortTerm;
  const monthly = Math.round(240 * 30.4 * 0.65);
  const annual = monthly * 12;
  assert.equal(str.nightlyRate, 240);
  assert.equal(str.monthlyGross, monthly);
  assert.equal(str.annualGross, annual);
  assert.equal(str.sourceNote, "Planning estimate, not RentCast data");
  const management = Math.round(annual * ASSUMPTIONS.shortTerm.managementRate);
  assert.equal(str.lines.find((line) => line.label === "Management")?.amount, management);
  // Revenue is already net of the platform fee; cleaning, supplies, repairs and utilities aren't modeled.
  assert.deepEqual(
    str.lines.map((line) => line.label),
    ["Management", "Added property tax"],
  );
  assert.equal(str.annualNet, str.annualGross - str.lines.reduce((sum, line) => sum + line.amount, 0));
  assert.equal(estimate.annualNet, str.annualNet);
  assert.equal(estimate.series[1]?.net, str.annualNet);
  assert.notEqual(estimate.scenarios.longTerm.annualNet, str.annualNet);
  assert.ok(estimate.notes.join(" ").includes("not RentCast"));
});

test("selecting the short-term scenario changes payback and the income approach", () => {
  const longTerm = calculateEstimate(input({ monthlyRent: 3040, rentalUse: "long_term" }));
  const shortTerm = calculateEstimate(input({ monthlyRent: 3040, rentalUse: "short_term" }));
  assert.equal(longTerm.incomeUplift, longTerm.scenarios.longTerm.incomeUplift);
  assert.equal(shortTerm.incomeUplift, shortTerm.scenarios.shortTerm.incomeUplift);
  assert.notEqual(longTerm.breakEvenYears, shortTerm.breakEvenYears);
  assert.equal(longTerm.sqftUplift, shortTerm.sqftUplift);
  assert.notEqual(longTerm.blendedUplift, shortTerm.blendedUplift);
});

test("the long-term lease only deducts vacancy and added property tax", () => {
  const lease = calculateEstimate(input({ monthlyRent: 3000 })).scenarios.longTerm;
  assert.deepEqual(
    lease.lines.map((line) => line.label),
    ["Vacancy", "Added property tax"],
  );
});

test("eco finish costs less than standard", () => {
  for (const projectType of ["garage_conversion", "attached_adu", "detached_adu"] as const) {
    const eco = calculateEstimate(input({ projectType, finish: "eco", sqft: 600 }));
    const standard = calculateEstimate(input({ projectType, finish: "standard", sqft: 600 }));
    assert.ok(eco.total < standard.total, projectType);
  }
});

test("reports saved with the retired luxury finish open as premium", () => {
  assert.equal(normalizeFinish("luxury"), "premium");
  assert.equal(normalizeFinish("eco"), "eco");
  assert.equal(normalizeFinish("gold"), null);
});

test("rent and nightly rates scale from the one reference lookup", () => {
  const reference = { sqft: 800, bedrooms: 2 };
  assert.equal(scaleRent(4000, reference, reference), 4000);
  assert.ok(scaleRent(4000, reference, { sqft: 500, bedrooms: 1 }) < 4000);
  assert.ok(scaleRent(4000, reference, { sqft: 1200, bedrooms: 3 }) > 4000);
  assert.equal(scaleNightlyRate(240, 2, 2), 240);
  assert.equal(scaleNightlyRate(240, 2, 1), 185);
});
