// How the homeowner pays for the ADU: cash, or a cash-out refinance topped up
// with an unsecured loan, and what that leaves each month once the rent comes in.

import { dollars } from "./money";

export const FINANCING = {
  /** Most lenders cap a cash-out refinance of a primary home at 80% of its value. */
  maxLoanToValue: 0.8,
  /** Lender, title and escrow costs, rolled into the new loan. */
  closingCostRate: 0.02,
  refiYears: 30,
  /** Starting refinance rate; the builder shows this week's Freddie Mac average next to it. */
  defaultRefiRate: 0.059,
  /** Personal loans for home improvement rarely go above this. */
  unsecuredMax: 100_000,
  unsecuredRate: 0.09,
  unsecuredYears: 20,
  unsecuredMaxYears: 30,
} as const;

export type FinancingPlan = "cash" | "refinance";

/** What the homeowner set in the builder; saved with the report. Rates are fractions (0.0728). */
export type FinancingInputs = {
  plan: FinancingPlan;
  homeValue: number | null;
  /** Zero or null when the home is paid off. */
  mortgageBalance: number | null;
  currentRate: number | null;
  /** Current principal and interest; estimated from the balance and rate when unknown. */
  currentPayment: number | null;
  refiRate: number | null;
  /** Older reports: the week of the Freddie Mac average that was filled in automatically. Now always null. */
  refiRateAsOf: string | null;
  unsecuredRate: number | null;
  /** Null uses the 20-year default. */
  unsecuredYears?: number | null;
  /** Cash the homeowner chooses to put in first, before borrowing. */
  cashDown?: number | null;
};

export type Financing = {
  plan: FinancingPlan;
  homeValue: number;
  mortgageBalance: number;
  equity: number;
  /** Cash a lender would release at 80% loan-to-value, after closing costs. */
  cashOutAvailable: number;
  cashOut: number;
  closingCosts: number;
  newLoan: number;
  refiRate: number;
  currentRate: number | null;
  currentPayment: number;
  currentPaymentEstimated: boolean;
  newPayment: number;
  /** New payment − current payment: what the refinance adds each month. */
  addedMortgagePayment: number;
  unsecuredAmount: number;
  unsecuredRate: number;
  unsecuredYears: number;
  unsecuredPayment: number;
  /** Cash the homeowner chose to put in, before any borrowing. */
  cashDown: number;
  /** What the homeowner pays from savings in all: the cash put in plus anything the loans don't cover. */
  cashFromOwner: number;
  monthlyDebt: number;
  /** ADU net income − added loan payments. */
  monthlyCashFlow: number;
  annualCashFlow: number;
  /** Annual cash flow ÷ cash from the owner; null when they put in nothing. */
  cashOnCash: number | null;
  loanToValueAfter: number | null;
  warnings: string[];
};

/** Monthly principal and interest on a fully amortizing loan. */
export function monthlyPayment(principal: number, annualRate: number, years: number): number {
  if (!(principal > 0)) return 0;
  const months = years * 12;
  const rate = annualRate / 12;
  if (!(rate > 0)) return dollars(principal / months);
  return dollars((principal * rate) / (1 - (1 + rate) ** -months));
}

const positive = (value: number | null | undefined): number => (value != null && Number.isFinite(value) && value > 0 ? value : 0);
const rateOr = (value: number | null | undefined, fallback: number): number =>
  value != null && Number.isFinite(value) && value > 0 && value < 0.5 ? value : fallback;

export function calculateFinancing(input: FinancingInputs, projectCost: number, monthlyNetIncome: number): Financing {
  const homeValue = positive(input.homeValue);
  const mortgageBalance = positive(input.mortgageBalance);
  const refiRate = rateOr(input.refiRate, FINANCING.defaultRefiRate);
  const unsecuredRate = rateOr(input.unsecuredRate, FINANCING.unsecuredRate);
  const unsecuredYears =
    input.unsecuredYears != null && input.unsecuredYears >= 1 && input.unsecuredYears <= FINANCING.unsecuredMaxYears
      ? input.unsecuredYears
      : FINANCING.unsecuredYears;
  const currentRate = input.currentRate != null && input.currentRate > 0 ? input.currentRate : null;
  const typedPayment = positive(input.currentPayment);
  const currentPaymentEstimated = mortgageBalance > 0 && typedPayment === 0;
  // Without a payment, assume a 30-year loan at the current rate (or today's rate when that's unknown too).
  const currentPayment = typedPayment || monthlyPayment(mortgageBalance, currentRate ?? refiRate, FINANCING.refiYears);
  const cost = positive(projectCost);
  const warnings: string[] = [];

  // The new loan pays off the old one, funds the cash-out, and carries its own closing costs:
  // newLoan = (balance + cashOut) / (1 − closing rate), capped at 80% of value.
  const maxLoan = homeValue * FINANCING.maxLoanToValue;
  const cashOutAvailable = Math.max(0, dollars(maxLoan * (1 - FINANCING.closingCostRate) - mortgageBalance));

  let cashOut = 0;
  let newLoan = mortgageBalance;
  let closingCosts = 0;
  let newPayment = currentPayment;
  let unsecuredAmount = 0;
  const cashDown = input.plan === "refinance" ? Math.min(positive(input.cashDown), cost) : 0;
  const toBorrow = cost - cashDown;
  if (input.plan === "refinance") {
    cashOut = Math.min(toBorrow, cashOutAvailable);
    if (cashOut > 0) {
      newLoan = dollars((mortgageBalance + cashOut) / (1 - FINANCING.closingCostRate));
      closingCosts = newLoan - mortgageBalance - cashOut;
      newPayment = monthlyPayment(newLoan, refiRate, FINANCING.refiYears);
    }
    unsecuredAmount = Math.min(toBorrow - cashOut, FINANCING.unsecuredMax);
    if (homeValue === 0) warnings.push("Add the home's value to see how much a refinance could release.");
    else if (cashOutAvailable === 0) warnings.push("At 80% of the home's value there's no equity to take out, so the refinance doesn't fund the build.");
    if (cashOut > 0 && currentRate != null && refiRate > currentRate + 0.0025) {
      warnings.push(
        `Refinancing replaces the ${(currentRate * 100).toFixed(2)}% rate on the whole ${dollarsLabel(mortgageBalance)} balance with ${(refiRate * 100).toFixed(2)}%. A home equity line or second mortgage keeps the current rate; ask a lender to compare.`,
      );
    }
  }

  const unsecuredPayment = monthlyPayment(unsecuredAmount, unsecuredRate, unsecuredYears);
  const addedMortgagePayment = addedPayment(newPayment, currentPayment, newLoan - mortgageBalance, refiRate);
  const cashFromOwner = Math.max(0, cost - cashOut - unsecuredAmount);
  const shortfall = cashFromOwner - cashDown;
  if (input.plan === "refinance" && shortfall > 0 && homeValue > 0) {
    warnings.push(`The refinance and a ${dollarsLabel(FINANCING.unsecuredMax)} unsecured loan leave ${dollarsLabel(shortfall)} more to pay from savings.`);
  }
  const monthlyDebt = addedMortgagePayment + unsecuredPayment;
  const monthlyCashFlow = dollars(monthlyNetIncome - monthlyDebt);
  const annualCashFlow = monthlyCashFlow * 12;

  return {
    plan: input.plan,
    homeValue,
    mortgageBalance,
    equity: homeValue - mortgageBalance,
    cashOutAvailable,
    cashOut,
    closingCosts,
    newLoan,
    refiRate,
    currentRate,
    currentPayment,
    currentPaymentEstimated,
    newPayment,
    addedMortgagePayment,
    unsecuredAmount,
    unsecuredRate,
    unsecuredYears,
    unsecuredPayment,
    cashDown,
    cashFromOwner,
    monthlyDebt,
    monthlyCashFlow,
    annualCashFlow,
    cashOnCash: cashFromOwner > 0 ? annualCashFlow / cashFromOwner : null,
    loanToValueAfter: homeValue > 0 ? newLoan / homeValue : null,
    warnings,
  };
}

/** Once the ADU is finished: the home is appraised with it, and the unsecured loan is rolled into the mortgage. */
export type RefinanceAfter = {
  appraisedValue: number;
  /** 80% of the new appraised value. */
  maxLoan: number;
  /** Unsecured balance paid off by the new mortgage; the rest, if any, stays as a personal loan. */
  unsecuredPaidOff: number;
  unsecuredLeft: number;
  newLoan: number;
  newPayment: number;
  unsecuredPayment: number;
  /** Added payments vs. before the ADU, after this refinance. */
  monthlyDebt: number;
  /** How much less each month than while the unsecured loan is open. */
  monthlySavings: number;
  interestSavedYearOne: number;
};

/**
 * The refinance after completion. The unsecured balance is taken as the full
 * amount, since the refinance happens soon after the build; closing costs are rolled in.
 * Null when there's no unsecured loan to refinance.
 */
export function refinanceAfterBuild(financing: Financing, valueAdded: number): RefinanceAfter | null {
  if (financing.plan !== "refinance" || financing.unsecuredAmount <= 0 || financing.homeValue <= 0) return null;
  const appraisedValue = financing.homeValue + Math.max(0, valueAdded);
  const maxLoan = dollars(appraisedValue * FINANCING.maxLoanToValue);
  const room = Math.max(0, dollars(maxLoan * (1 - FINANCING.closingCostRate) - financing.newLoan));
  const unsecuredPaidOff = Math.min(financing.unsecuredAmount, room);
  const unsecuredLeft = financing.unsecuredAmount - unsecuredPaidOff;
  // Nothing to fold in: there's no second refinance.
  if (unsecuredPaidOff <= 0) return null;
  const newLoan = dollars((financing.newLoan + unsecuredPaidOff) / (1 - FINANCING.closingCostRate));
  const newPayment = monthlyPayment(newLoan, financing.refiRate, FINANCING.refiYears);
  const unsecuredPayment = monthlyPayment(unsecuredLeft, financing.unsecuredRate, financing.unsecuredYears);
  const monthlyDebt =
    addedPayment(newPayment, financing.currentPayment, newLoan - financing.mortgageBalance, financing.refiRate) + unsecuredPayment;
  // Only worth suggesting when it lowers the monthly payments.
  if (monthlyDebt >= financing.monthlyDebt) return null;
  return {
    appraisedValue,
    maxLoan,
    unsecuredPaidOff,
    unsecuredLeft,
    newLoan,
    newPayment,
    unsecuredPayment,
    monthlyDebt,
    monthlySavings: financing.monthlyDebt - monthlyDebt,
    interestSavedYearOne: dollars(unsecuredPaidOff * (financing.unsecuredRate - financing.refiRate)),
  };
}

/**
 * What the ADU adds to the mortgage payment. A refinance can lower the payment on the loan
 * already there (a high-rate or short-term loan replaced by a 30-year one); that saving isn't
 * the ADU's, so the ADU always carries at least the payment on the money it borrowed.
 */
function addedPayment(newPayment: number, currentPayment: number, borrowed: number, rate: number): number {
  return Math.max(newPayment - currentPayment, monthlyPayment(Math.max(0, borrowed), rate, FINANCING.refiYears));
}

function dollarsLabel(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function bounded(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

export function parseFinancingInputs(input: unknown): FinancingInputs | null {
  const data = record(input);
  if (!data) return null;
  return {
    plan: data.plan === "refinance" ? "refinance" : "cash",
    homeValue: bounded(data.homeValue, 0, 100_000_000),
    mortgageBalance: bounded(data.mortgageBalance, 0, 100_000_000),
    currentRate: bounded(data.currentRate, 0, 0.3),
    currentPayment: bounded(data.currentPayment, 0, 1_000_000),
    refiRate: bounded(data.refiRate, 0, 0.3),
    refiRateAsOf: typeof data.refiRateAsOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.refiRateAsOf) ? data.refiRateAsOf : null,
    unsecuredRate: bounded(data.unsecuredRate, 0, 0.4),
    unsecuredYears: bounded(data.unsecuredYears, 1, FINANCING.unsecuredMaxYears),
    cashDown: bounded(data.cashDown, 0, 100_000_000),
  };
}
