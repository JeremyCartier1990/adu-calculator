import assert from "node:assert/strict";
import test from "node:test";
import { isCaliforniaAddress, validateAddress } from "./address";

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
