import assert from "node:assert/strict";
import test from "node:test";
import { isCaliforniaAddress, splitAddress, validateAddress } from "./address";

test("California addresses are accepted in the usual formats", () => {
  for (const address of [
    "2543 Walnut Ave, Venice, CA 90291, USA",
    "2543 Walnut Ave, Venice, CA",
    "2543 Walnut Ave Venice CA 90291",
    "100 Main St, Fresno, California",
    "12 Oak St, Oakland, ca 94607-1234",
  ]) {
    assert.ok(isCaliforniaAddress(address), address);
    assert.equal(validateAddress(address).ok, true, address);
  }
});

test("other states, and addresses with no state, are refused for now", () => {
  for (const address of ["350 5th Ave, New York, NY 10118", "1 Las Vegas Blvd, Las Vegas, NV", "2543 Walnut Ave Venice", "12 Cass St, Carson City, NV 89701"]) {
    assert.equal(isCaliforniaAddress(address), false, address);
    const result = validateAddress(address);
    assert.equal(result.ok, false, address);
    if (!result.ok) assert.match(result.message, /California/);
  }
});

test("the team builder takes addresses in any state", () => {
  assert.equal(validateAddress("350 5th Ave, New York, NY 10118", { californiaOnly: false }).ok, true);
  assert.equal(validateAddress("abc", { californiaOnly: false }).ok, false);
});

test("addresses split into street, city, state, and ZIP", () => {
  assert.deepEqual(splitAddress("2543 Walnut Ave, Venice, CA 90291, USA"), {
    street: "2543 Walnut Ave",
    city: "Venice",
    state: "CA",
    zipcode: "90291",
  });
  assert.deepEqual(splitAddress("12 Oak St, Apt 4, Los Angeles, California 90001-1234"), {
    street: "12 Oak St, Apt 4",
    city: "Los Angeles",
    state: "CA",
    zipcode: "90001-1234",
  });
  assert.deepEqual(splitAddress("500 Main St, Austin, TX"), { street: "500 Main St", city: "Austin", state: "TX", zipcode: null });
  assert.deepEqual(splitAddress("123 Main St, Venice"), { street: "123 Main St", city: "Venice", state: null, zipcode: null });
  assert.deepEqual(splitAddress("500 Main St"), { street: "500 Main St", city: null, state: null, zipcode: null });
});
