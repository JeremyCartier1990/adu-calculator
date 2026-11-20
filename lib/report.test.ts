import assert from "node:assert/strict";
import test from "node:test";
import { parsePropertyFacts, withPropertyFacts, type ConfirmedProperty } from "./report";

const PROPERTY: ConfirmedProperty = {
  address: "2543 Walnut Ave, Venice, CA 90291",
  squareFootage: 1500,
  lotSize: 5000,
  bedrooms: 3,
  bathrooms: 2,
  yearBuilt: 1950,
  propertyType: "Single Family",
  homeValue: 1_800_000,
  latitude: 34,
  longitude: -118,
  source: "rentcast",
  edited: ["lotSize"],
};

test("property facts are bounded like the confirmed property", () => {
  const facts = parsePropertyFacts({ squareFootage: 1600, lotSize: 12, bedrooms: "3", homeValue: 2_000_000 });
  assert.deepEqual(facts, { squareFootage: 1600, lotSize: null, bedrooms: null, bathrooms: null, yearBuilt: null, homeValue: 2_000_000 });
  assert.equal(parsePropertyFacts("nope"), null);
});

test("changed facts are saved and marked edited", () => {
  const same = withPropertyFacts(PROPERTY, { squareFootage: 1500, lotSize: 5000, bedrooms: 3, bathrooms: 2, yearBuilt: 1950, homeValue: 1_800_000 });
  assert.equal(same, PROPERTY);
  const next = withPropertyFacts(PROPERTY, { squareFootage: 1500, lotSize: 5000, bedrooms: 3, bathrooms: 2, yearBuilt: 1950, homeValue: 2_100_000 });
  assert.equal(next.homeValue, 2_100_000);
  assert.equal(next.address, PROPERTY.address);
  assert.deepEqual(next.edited, ["lotSize", "homeValue"]);
});
