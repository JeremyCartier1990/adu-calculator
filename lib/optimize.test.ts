import assert from "node:assert/strict";
import test from "node:test";
import { bestSetup, maxSqftFor, openingSetup, setupGain, suggestedSqft } from "./optimize";

const HOME = { homeSquareFootage: 1500, homeValue: 1_200_000, lotSize: 6000 };

test("size limits follow the state rules", () => {
  assert.equal(maxSqftFor("detached_adu", HOME), 1200);
  assert.equal(maxSqftFor("detached_adu", { ...HOME, lotSize: 3000 }), 800);
  assert.equal(maxSqftFor("attached_adu", HOME), 850);
  assert.equal(maxSqftFor("attached_adu", { ...HOME, homeSquareFootage: 2200 }), 1100);
  assert.equal(maxSqftFor("attached_adu", { ...HOME, homeSquareFootage: null }), 850);
});

test("the suggested size follows the lot and stays between 500 and 800 sqft", () => {
  assert.equal(suggestedSqft(null), 600);
  assert.equal(suggestedSqft(2500), 500);
  assert.equal(suggestedSqft(4000), 500);
  assert.equal(suggestedSqft(5000), 600);
  assert.equal(suggestedSqft(6000), 700);
  assert.equal(suggestedSqft(7500), 800);
  assert.equal(suggestedSqft(20000), 800);
});

test("the best setup opens at the suggested size on the better ADU type", () => {
  const best = bestSetup(HOME);
  assert.equal(best.finish, "eco");
  assert.equal(best.sqft, 700);
  const other = best.projectType === "detached_adu" ? "attached_adu" : "detached_adu";
  assert.ok(setupGain(best, HOME) >= setupGain({ ...best, projectType: other }, HOME));
  for (const lotSize of [null, 3000, 5000, 9000]) {
    const sqft = bestSetup({ ...HOME, lotSize }).sqft;
    assert.ok(sqft >= 500 && sqft <= 800, `${lotSize}: ${sqft}`);
  }
});

test("a new report opens on the ADU type the homeowner picked", () => {
  assert.deepEqual(openingSetup(HOME, null), bestSetup(HOME));
  assert.deepEqual(openingSetup(HOME, "detached_adu"), { projectType: "detached_adu", finish: "eco", sqft: 700 });
  assert.deepEqual(openingSetup(HOME, "garage_conversion"), { projectType: "garage_conversion", finish: "eco", sqft: 400 });
});
