import assert from "node:assert/strict";
import test from "node:test";
import { ASSUMPTIONS, bedroomsForSqft, snapSqft } from "./assumptions";
import { calculateEstimate, fallbackMonthlyRent, type EstimateInput } from "./calculate";

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

test("garage conversion cost sheet matches the published rates", () => {
  const estimate = calculateEstimate(input());
  const construction = Math.round(400 * 265);
  const design = Math.round(4000 + 7 * 400);
  const city = Math.round(5800 + 4 * 400);
  const school = 0;
  const utility = 4000;
  assert.equal(estimate.construction, construction);
  assert.equal(estimate.design, design);
  assert.equal(estimate.cityFees, city);
  assert.equal(estimate.schoolFees, school);
  assert.equal(estimate.utilityFees, utility);
  assert.equal(estimate.permitsAndFees, city + school + utility);
  assert.equal(estimate.total, construction + design + city + school + utility);
  assert.equal(
    ASSUMPTIONS.costPerSqft.garage_conversion.standard,
    265,
    "Update this test in the same edit if you retune assumptions.ts",
  );
  assert.match(estimate.notes.join(" "), /\$265 per square foot/);
});

test("school fees start at 750 sqft and stay off below it", () => {
  const under = calculateEstimate(input({ sqft: 740, projectType: "attached_adu" }));
  const over = calculateEstimate(input({ sqft: 750, projectType: "attached_adu" }));
  assert.equal(under.schoolFees, 0);
  assert.ok(over.schoolFees > 0);
  assert.equal(over.schoolFees, Math.round(750 * ASSUMPTIONS.permits.schoolFeePerSqft));
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
