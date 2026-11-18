import assert from "node:assert/strict";
import test from "node:test";
import { readVerifiedPhone, signVerifiedPhone, VERIFY_COOKIE_MAX_AGE_SECONDS } from "./verify-cookie";

const secret = "test-secret-at-least-16";

test("a signed phone ticket reads back and rejects tampering and expiry", () => {
  const now = 1_700_000_000_000;
  const token = signVerifiedPhone("+13105550100", secret, now);
  assert.equal(readVerifiedPhone(token, secret, now + 1000), "+13105550100");
  assert.equal(readVerifiedPhone(token, "wrong-secret-value!!", now + 1000), null);
  assert.equal(readVerifiedPhone(`${token}x`, secret, now + 1000), null);
  assert.equal(
    readVerifiedPhone(token, secret, now + VERIFY_COOKIE_MAX_AGE_SECONDS * 1000 + 1),
    null,
  );
});
