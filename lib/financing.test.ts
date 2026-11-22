import assert from "node:assert/strict";
import test from "node:test";
import { calculateFinancing, FINANCING, monthlyPayment, parseFinancingInputs, refinanceAfterBuild, type FinancingInputs } from "./financing";

const BASE: FinancingInputs = {
  plan: "refinance",
  homeValue: 1_500_000,
  mortgageBalance: 600_000,
  currentRate: 0.035,
  currentPayment: 3_000,
  refiRate: 0.07,
  refiRateAsOf: "2026-11-19",
  unsecuredRate: 0.12,
};

test("a 30-year payment matches the standard formula", () => {
  assert.equal(monthlyPayment(400_000, 0.07, 30), 2661);
  assert.equal(monthlyPayment(0, 0.07, 30), 0);
  assert.equal(monthlyPayment(1200, 0, 1), 100);
});

test("cash pays for everything and adds no debt", () => {
  const plan = calculateFinancing({ ...BASE, plan: "cash" }, 300_000, 2_000);
  assert.equal(plan.cashFromOwner, 300_000);
  assert.equal(plan.monthlyDebt, 0);
  assert.equal(plan.monthlyCashFlow, 2_000);
});

test("enough equity funds the whole build with a refinance", () => {
  const plan = calculateFinancing(BASE, 300_000, 2_000);
  assert.equal(plan.cashOut, 300_000);
  assert.equal(plan.unsecuredAmount, 0);
  assert.equal(plan.cashFromOwner, 0);
  assert.ok(plan.newLoan <= 1_500_000 * FINANCING.maxLoanToValue);
  assert.equal(plan.newLoan - plan.closingCosts - plan.cashOut, 600_000);
  assert.equal(plan.monthlyCashFlow, 2_000 - (plan.newPayment - 3_000));
  assert.equal(plan.cashOnCash, null);
  assert.ok(plan.warnings.some((warning) => warning.includes("3.50%")));
});

test("the unsecured loan covers the gap, up to its cap", () => {
  const thin = calculateFinancing({ ...BASE, homeValue: 900_000 }, 300_000, 2_000);
  // 900k × 80% × 98% − 600k = 105,600 of cash out.
  assert.equal(thin.cashOut, 105_600);
  assert.equal(thin.unsecuredAmount, 100_000);
  assert.equal(thin.cashFromOwner, 300_000 - 105_600 - 100_000);
  assert.equal(thin.unsecuredPayment, monthlyPayment(100_000, 0.12, 20));
});

test("no equity leaves the refinance out and says so", () => {
  const plan = calculateFinancing({ ...BASE, homeValue: 700_000 }, 80_000, 1_000);
  assert.equal(plan.cashOut, 0);
  assert.equal(plan.addedMortgagePayment, 0);
  assert.equal(plan.unsecuredAmount, 80_000);
  assert.ok(plan.warnings.some((warning) => warning.includes("no equity")));
});

test("a missing payment is estimated from the balance and rate", () => {
  const plan = calculateFinancing({ ...BASE, currentPayment: null }, 100_000, 1_000);
  assert.equal(plan.currentPaymentEstimated, true);
  assert.equal(plan.currentPayment, monthlyPayment(600_000, 0.035, 30));
});

test("saved financing is parsed defensively", () => {
  assert.equal(parseFinancingInputs(null), null);
  const parsed = parseFinancingInputs({ plan: "refinance", homeValue: -5, refiRate: 7.2, refiRateAsOf: "nope", mortgageBalance: 500000 });
  assert.equal(parsed?.plan, "refinance");
  assert.equal(parsed?.homeValue, null);
  assert.equal(parsed?.refiRate, null);
  assert.equal(parsed?.refiRateAsOf, null);
  assert.equal(parsed?.mortgageBalance, 500000);
});

test("the unsecured loan term defaults to 20 years and can be changed", () => {
  const plan = { ...BASE, homeValue: 700_000 };
  assert.equal(calculateFinancing(plan, 80_000, 1_000).unsecuredYears, 20);
  const short = calculateFinancing({ ...plan, unsecuredYears: 7 }, 80_000, 1_000);
  assert.equal(short.unsecuredYears, 7);
  assert.equal(short.unsecuredPayment, monthlyPayment(80_000, 0.12, 7));
  assert.equal(calculateFinancing({ ...plan, unsecuredYears: 99 }, 80_000, 1_000).unsecuredYears, 20);
});

test("after the build, the reappraised home refinances the unsecured loan at the mortgage rate", () => {
  const during = calculateFinancing({ ...BASE, homeValue: 900_000 }, 300_000, 2_000);
  assert.equal(during.unsecuredAmount, 100_000);
  const after = refinanceAfterBuild(during, 350_000)!;
  assert.equal(after.appraisedValue, 1_250_000);
  assert.equal(after.unsecuredPaidOff, 100_000);
  assert.equal(after.unsecuredLeft, 0);
  assert.equal(after.unsecuredPayment, 0);
  assert.ok(after.newLoan <= after.maxLoan);
  assert.equal(after.newPayment, monthlyPayment(after.newLoan, 0.07, 30));
  assert.ok(after.monthlySavings > 0);
});

test("a small value gain only pays off part of the unsecured loan", () => {
  const during = calculateFinancing({ ...BASE, homeValue: 900_000 }, 300_000, 2_000);
  const after = refinanceAfterBuild(during, 120_000)!;
  assert.ok(after.unsecuredPaidOff > 0 && after.unsecuredPaidOff < 100_000);
  assert.equal(after.unsecuredLeft, 100_000 - after.unsecuredPaidOff);
  assert.ok(after.monthlyDebt < during.monthlyDebt);
});

test("a refinance that would raise the payments isn't suggested", () => {
  // Closing costs on the whole mortgage to pay off about $1,300 of the unsecured loan.
  const during = calculateFinancing({ ...BASE, homeValue: 900_000 }, 300_000, 2_000);
  assert.equal(refinanceAfterBuild(during, 20_000), null);
});

test("nothing to refinance without an unsecured loan", () => {
  assert.equal(refinanceAfterBuild(calculateFinancing(BASE, 300_000, 2_000), 400_000), null);
  assert.equal(refinanceAfterBuild(calculateFinancing({ ...BASE, plan: "cash" }, 300_000, 2_000), 400_000), null);
});

test("cash put in first shrinks what's borrowed", () => {
  const plan = calculateFinancing({ ...BASE, homeValue: 900_000, cashDown: 150_000 }, 300_000, 2_000);
  assert.equal(plan.cashDown, 150_000);
  assert.equal(plan.cashOut, 105_600);
  assert.equal(plan.unsecuredAmount, 300_000 - 150_000 - 105_600);
  assert.equal(plan.cashFromOwner, 150_000);
  assert.ok(!plan.warnings.some((warning) => warning.includes("more to pay from savings")));
  assert.equal(calculateFinancing({ ...BASE, cashDown: 999_999 }, 300_000, 2_000).cashFromOwner, 300_000);
});

test("refinance savings on the existing loan never count as ADU income", () => {
  // A $1.46M short-term bridge loan at $85,626 a month on a $996,000 home.
  const inputs = {
    plan: "refinance" as const,
    homeValue: 996_000,
    mortgageBalance: 1_462_922,
    currentRate: 0.0666,
    currentPayment: 85_626,
    refiRate: 0.059,
    refiRateAsOf: null,
    unsecuredRate: 0.09,
  };
  const financing = calculateFinancing(inputs, 318_400, 2_995);
  assert.equal(financing.cashOut, 0);
  assert.ok(financing.addedMortgagePayment >= 0);
  assert.ok(financing.monthlyDebt > 0);
  const after = refinanceAfterBuild(financing, 419_570);
  if (after) assert.ok(after.monthlyDebt > 0);
});

test("a cheaper refinance still charges the ADU for the money it borrowed", () => {
  const financing = calculateFinancing(
    { plan: "refinance", homeValue: 1_000_000, mortgageBalance: 300_000, currentRate: 0.09, currentPayment: 2_414, refiRate: 0.059, refiRateAsOf: null, unsecuredRate: 0.09 },
    200_000,
    2_000,
  );
  assert.ok(financing.cashOut > 0);
  assert.ok(financing.addedMortgagePayment > 0);
});
