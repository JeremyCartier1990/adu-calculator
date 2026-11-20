import assert from "node:assert/strict";
import test from "node:test";
import { bestSetup, maxSqftFor, setupGain } from "./optimize";

const HOME = { homeSquareFootage: 1500, homeValue: 1_200_000, lotSize: 6000 };

test("size limits follow the state rules", () => {
  assert.equal(maxSqftFor("detached_adu", HOME), 1200);
  assert.equal(maxSqftFor("detached_adu", { ...HOME, lotSize: 3000 }), 800);
  assert.equal(maxSqftFor("attached_adu", HOME), 850);
  assert.equal(maxSqftFor("attached_adu", { ...HOME, homeSquareFootage: 2200 }), 1100);
  assert.equal(maxSqftFor("attached_adu", { ...HOME, homeSquareFootage: null }), 850);
});

test("the best setup stays inside the limits and beats the other options", () => {
  const best = bestSetup(HOME);
  assert.equal(best.finish, "standard");
  assert.ok(best.sqft <= maxSqftFor(best.projectType, HOME));
  const gain = setupGain(best, HOME);
  for (const sqft of [400, 600, 800]) {
    assert.ok(gain >= setupGain({ projectType: "detached_adu", finish: "standard", sqft }, HOME));
    assert.ok(gain >= setupGain({ projectType: "attached_adu", finish: "standard", sqft }, HOME));
  }
});

test("a tight lot keeps a detached pick at 800 sqft or less", () => {
  const best = bestSetup({ ...HOME, lotSize: 3000 });
  if (best.projectType === "detached_adu") assert.ok(best.sqft <= 800);
});
