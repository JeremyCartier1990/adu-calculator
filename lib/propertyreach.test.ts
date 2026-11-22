import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePropertyReach, parsePropertyReachFacts, paymentOnRecord, propertyReachUrl, splitUsAddress } from "./propertyreach";

test("splits a Google-formatted US address", () => {
  assert.deepEqual(splitUsAddress("2543 Walnut Ave, Venice, CA 90291, USA"), {
    streetAddress: "2543 Walnut Ave",
    city: "Venice",
    state: "CA",
    zip: "90291",
  });
  assert.deepEqual(splitUsAddress("12 Elm St, Unit 4, Pasadena, ca"), {
    streetAddress: "12 Elm St, Unit 4",
    city: "Pasadena",
    state: "CA",
  });
  assert.equal(splitUsAddress("somewhere in LA"), null);
});

test("falls back to coordinates when the address can't be split", () => {
  const url = new URL(propertyReachUrl("Venice beach house", 33.99, -118.48)!);
  assert.equal(url.searchParams.get("latitude"), "33.99");
  assert.equal(propertyReachUrl("Venice beach house", null, null), null);
});

test("keeps active loans and computes credit-line room at 80% CLTV", () => {
  const financials = parsePropertyReach(
    {
      meta: { resultCount: 1 },
      property: {
        estimatedValue: 3_000_000,
        estimatedEquity: 900_000,
        loanToValueRatio: 0.7,
        loanBalance: 2_100_000,
        loanPaymentAmount: 12_000,
        openLoanCount: 1,
        ownerOccupied: true,
        ownerNames: "Pat Doe",
        taxAmount: 30_000.5,
        openLoans: [
          { active: true, lenderName: "Bank", rate: 0.05, amount: 2_170_000, estimatedBalance: 2_100_000, term: 360 },
          { active: false, lenderName: "Old Bank", amount: 1 },
        ],
      },
    },
    "2026-11-19T00:00:00.000Z",
  );
  assert.ok(financials);
  assert.equal(financials.loans.length, 1);
  assert.equal(financials.loans[0].lender, "Bank");
  assert.equal(financials.helocCapacity, 300_000);
  assert.equal(financials.ownerOccupied, true);
  assert.equal(parsePropertyReach({ meta: { resultCount: 0 } }), null);
});

test("reads confirm-step facts and the value estimate", () => {
  const facts = parsePropertyReachFacts({
    property: {
      streetAddress: "2543 Walnut Ave",
      city: "Venice",
      state: "CA",
      zip: "90291",
      livingSquareFeet: 3316,
      lotSquareFeet: 6096,
      bedrooms: 4,
      bathrooms: 5,
      yearBuilt: 2021,
      propertyType: "Single Family",
      estimatedValue: 3_121_000,
      latitude: 33.99,
      longitude: -118.44,
    },
  });
  assert.equal(facts?.property.formattedAddress, "2543 Walnut Ave, Venice, CA 90291");
  assert.equal(facts?.property.squareFootage, 3316);
  assert.equal(facts?.value.price, 3_121_000);
  assert.equal(parsePropertyReachFacts({ meta: { resultCount: 0 } }), null);
});

test("a short bridge loan counts as interest-only, not repaid over its term", () => {
  const loan = (termMonths: number, extra = {}) => ({
    lender: null,
    loanType: null,
    rateType: null,
    rate: 0.0666,
    amount: 1_540_000,
    estimatedBalance: 1_462_922,
    estimatedPayment: 85_626,
    termMonths,
    recordingDate: null,
    ...extra,
  });
  const bridge = paymentOnRecord({ loans: [loan(19)], monthlyPayment: 85_626 });
  assert.deepEqual(bridge, { payment: Math.round((1_462_922 * 0.0666) / 12), interestOnly: true });
  const mortgage = paymentOnRecord({ loans: [loan(360, { estimatedPayment: 9_200 })], monthlyPayment: 9_200 });
  assert.deepEqual(mortgage, { payment: 9_200, interestOnly: false });
});
