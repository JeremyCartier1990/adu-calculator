import assert from "node:assert/strict";
import test from "node:test";
import { resetRateLimits, takeToken } from "./rate-limit";

test("rate limit allows a window of calls and then blocks", () => {
  resetRateLimits();
  const now = 1_000_000;
  assert.equal(takeToken("rent", "10.0.0.1", 2, 60_000, now), true);
  assert.equal(takeToken("rent", "10.0.0.1", 2, 60_000, now + 10), true);
  assert.equal(takeToken("rent", "10.0.0.1", 2, 60_000, now + 20), false);
  assert.equal(takeToken("rent", "10.0.0.2", 2, 60_000, now + 20), true);
  assert.equal(takeToken("rent", "10.0.0.1", 2, 60_000, now + 60_001), true);
  resetRateLimits();
});
