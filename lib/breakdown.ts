import { ASSUMPTIONS } from "./assumptions";
import type { Estimate } from "./calculate";
import { calculateFinancing, FINANCING, type Financing, type FinancingInputs } from "./financing";
import { formatMoney, formatNumber } from "./money";

/**
 * The report's headline and the math behind it, as plain data, so the live
 * builder, the shared report and the PDF all say exactly the same thing.
 */

export type BreakdownLine = { label: string; math?: string; value: string; strong?: boolean };
export type BreakdownStep = { n: string; title: string; result: string; lines: BreakdownLine[]; note?: string };

export type Headline = {
  invest: number;
  valueAdded: number;
  homeValueBefore: number | null;
  homeValueAfter: number | null;
  equity: number;
  monthlyDebt: number;
  financed: boolean;
  longTerm: number;
  shortTerm: number;
  funding: string;
};

const CASH: FinancingInputs = {
  plan: "cash",
  homeValue: null,
  mortgageBalance: null,
  currentRate: null,
  currentPayment: null,
  refiRate: null,
  refiRateAsOf: null,
  unsecuredRate: null,
};

/** Reports saved before financing existed are treated as paid in cash. */
export function financingFor(inputs: FinancingInputs | null | undefined, estimate: Estimate): Financing {
  return calculateFinancing(inputs ?? CASH, estimate.total, estimate.scenarios.longTerm.monthlyNet);
}

const pct = (rate: number, digits = 0) => `${(rate * 100).toFixed(digits)}%`;
const perMonth = (value: number) => `${formatMoney(value)} / mo`;
const minus = (value: number) => `−${formatMoney(value)}`;

function fundingLine(financing: Financing): string {
  if (financing.plan === "cash") return "paid from savings";
  const parts = [
    financing.cashOut > 0 ? `${formatMoney(financing.cashOut)} cash-out refinance` : null,
    financing.unsecuredAmount > 0 ? `${formatMoney(financing.unsecuredAmount)} unsecured loan` : null,
    financing.cashFromOwner > 0 ? `${formatMoney(financing.cashFromOwner)} from savings` : null,
  ].filter(Boolean);
  return parts.join(" + ") || "nothing to fund";
}

export function headline(estimate: Estimate, financing: Financing): Headline {
  const before = estimate.newHomeValue == null ? null : estimate.newHomeValue - estimate.blendedUplift;
  return {
    invest: estimate.total,
    valueAdded: estimate.blendedUplift,
    homeValueBefore: before,
    homeValueAfter: estimate.newHomeValue,
    equity: estimate.equity,
    monthlyDebt: financing.monthlyDebt,
    financed: financing.monthlyDebt > 0,
    longTerm: estimate.scenarios.longTerm.monthlyNet - financing.monthlyDebt,
    shortTerm: estimate.scenarios.shortTerm.monthlyNet - financing.monthlyDebt,
    funding: fundingLine(financing),
  };
}

/** Every number in the headline, worked out step by step with this report's own figures. */
export function breakdownSteps(estimate: Estimate, financing: Financing): BreakdownStep[] {
  const { sqft, projectType, finish } = estimate;
  const rate = ASSUMPTIONS.costPerSqft[projectType][finish];
  const design = ASSUMPTIONS.design[finish];
  const permits = ASSUMPTIONS.permits;
  const factor = ASSUMPTIONS.value.sqftFactor[projectType];
  const weight = ASSUMPTIONS.value.sqftApproachWeight;
  const capRate = ASSUMPTIONS.value.capRate;
  const ops = ASSUMPTIONS.operations;
  const { longTerm, shortTerm } = estimate.scenarios;
  const homeBefore = estimate.newHomeValue == null ? null : estimate.newHomeValue - estimate.blendedUplift;
  const size = `${formatNumber(sqft)} sqft`;
  const refinance = financing.plan === "refinance";

  const steps: BreakdownStep[] = [
    {
      n: "1",
      title: "What it costs",
      result: formatMoney(estimate.total),
      lines: [
        { label: "Construction", math: `${size} × ${formatMoney(rate)} per sqft`, value: formatMoney(estimate.construction) },
        { label: "Architectural plans", math: `${formatMoney(design.base)} + ${formatMoney(design.perSqft)} × ${size}`, value: formatMoney(estimate.design) },
        { label: "City permits", math: `${formatMoney(permits.cityPermitBase)} + ${formatMoney(permits.cityPermitPerSqft)} × ${size}`, value: formatMoney(estimate.cityFees) },
        { label: "Total investment", value: formatMoney(estimate.total), strong: true },
      ],
      note: `${estimate.finishLabel} finish rate for a ${estimate.projectLabel.replace(/^\w/, (letter) => letter.toLowerCase())}. School fees and utility connections aren't included.`,
    },
    {
      n: "2",
      title: "What it adds to your home",
      result: `+${formatMoney(estimate.blendedUplift)}`,
      lines: [
        {
          label: "Your home per sqft",
          math: estimate.usedFallbackValuePerSqft ? "Planning rate: home size or value missing" : `${formatMoney(homeBefore ?? 0)} ÷ home size`,
          value: formatMoney(estimate.valuePerSqft),
        },
        { label: "Square-foot approach", math: `${formatMoney(estimate.valuePerSqft)} × ${size} × ${pct(factor)} for an ADU`, value: formatMoney(estimate.sqftUplift) },
        estimate.incomeUplift == null
          ? { label: "Income approach", math: "Not used: the lease doesn't net a profit", value: "—" }
          : { label: "Income approach", math: `${formatMoney(longTerm.annualNet)} lease net a year ÷ ${pct(capRate, 1)} cap rate`, value: formatMoney(estimate.incomeUplift) },
        {
          label: "Value added",
          math: estimate.incomeUplift == null ? "Square-foot approach only" : `${pct(weight)} square-foot + ${pct(1 - weight)} income`,
          value: formatMoney(estimate.blendedUplift),
          strong: true,
        },
        ...(homeBefore != null && estimate.newHomeValue != null
          ? [{ label: "Home value after", math: `${formatMoney(homeBefore)} + ${formatMoney(estimate.blendedUplift)}`, value: formatMoney(estimate.newHomeValue) }]
          : []),
        { label: "Equity created", math: "Value added − total investment", value: formatMoney(estimate.equity) },
      ],
    },
    {
      n: "3",
      title: "What it rents for",
      result: `${formatMoney(longTerm.monthlyNet)} or ${formatMoney(shortTerm.monthlyNet)} / mo`,
      lines: [
        { label: "Long-term lease", math: `${formatMoney(longTerm.monthlyGross)} rent × 12 months`, value: formatMoney(longTerm.annualGross) },
        ...longTerm.lines.map((line) => ({ label: line.label, math: line.hint, value: minus(line.amount) })),
        { label: "Long-term net", math: `${formatMoney(longTerm.annualNet)} a year ÷ 12`, value: perMonth(longTerm.monthlyNet), strong: true },
        {
          label: "Short-term rental",
          math: `${formatMoney(shortTerm.nightlyRate ?? 0)} a night × ${ASSUMPTIONS.shortTerm.daysPerMonth} nights × ${pct(shortTerm.occupancy ?? 0)} booked × 12`,
          value: formatMoney(shortTerm.annualGross),
        },
        ...shortTerm.lines.map((line) => ({ label: line.label, math: line.hint, value: minus(line.amount) })),
        { label: "Short-term net", math: `${formatMoney(shortTerm.annualNet)} a year ÷ 12`, value: perMonth(shortTerm.monthlyNet), strong: true },
      ],
      note: `Rent: ${longTerm.sourceNote}. Rent grows ${pct(ops.rentGrowthRate)} a year after that. Maintenance, utilities and insurance aren't included.`,
    },
    {
      n: "4",
      title: "How it's paid for",
      result: refinance ? `${formatMoney(financing.monthlyDebt)} / mo in loans` : "Cash, no loan payments",
      lines: refinance
        ? [
            {
              label: "Cash-out refinance",
              math: `New ${formatMoney(financing.newLoan)} loan at ${pct(financing.refiRate, 2)}, ${FINANCING.refiYears} years, up to ${pct(FINANCING.maxLoanToValue)} of value`,
              value: formatMoney(financing.cashOut),
            },
            {
              label: "Unsecured loan",
              math: `${pct(financing.unsecuredRate, 2)} for ${financing.unsecuredYears} years, up to ${formatMoney(FINANCING.unsecuredMax)}`,
              value: formatMoney(financing.unsecuredAmount),
            },
            { label: "From savings", value: formatMoney(financing.cashFromOwner) },
            {
              label: "Added mortgage payment",
              math: `${formatMoney(financing.currentPayment)}${financing.currentPaymentEstimated ? " (est.)" : ""} today → ${formatMoney(financing.newPayment)}`,
              value: perMonth(financing.addedMortgagePayment),
            },
            { label: "Unsecured loan payment", value: perMonth(financing.unsecuredPayment) },
            { label: "Added loan payments", value: perMonth(financing.monthlyDebt), strong: true },
          ]
        : [
            { label: "From savings", value: formatMoney(financing.cashFromOwner) },
            { label: "Added loan payments", value: perMonth(0), strong: true },
          ],
    },
    {
      n: "5",
      title: "What you keep each month",
      result: `${formatMoney(longTerm.monthlyNet - financing.monthlyDebt)} or ${formatMoney(shortTerm.monthlyNet - financing.monthlyDebt)}`,
      lines: [
        { label: "Long-term lease", math: `${formatMoney(longTerm.monthlyNet)} net − ${formatMoney(financing.monthlyDebt)} loans`, value: perMonth(longTerm.monthlyNet - financing.monthlyDebt), strong: true },
        { label: "Short-term rental", math: `${formatMoney(shortTerm.monthlyNet)} net − ${formatMoney(financing.monthlyDebt)} loans`, value: perMonth(shortTerm.monthlyNet - financing.monthlyDebt), strong: true },
      ],
    },
  ];
  return steps;
}

/** The settings behind the numbers, as short chips. */
export function settingsUsed(estimate: Estimate, financing: Financing, property: { homeValue: number | null; squareFootage: number | null; lotSize: number | null }): string[] {
  const { shortTerm } = estimate.scenarios;
  const rentSource = estimate.rentSource === "rentcast" ? "RentCast comps" : estimate.rentSource === "manual" ? "your figure" : "planning rate";
  return [
    estimate.projectLabel,
    `${formatNumber(estimate.sqft)} sqft · ${estimate.bedroomLabel}`,
    `${estimate.finishLabel} finish`,
    `Rent ${formatMoney(estimate.monthlyRent)} / mo (${rentSource})`,
    `${formatMoney(shortTerm.nightlyRate ?? 0)} a night at ${pct(shortTerm.occupancy ?? 0)}`,
    property.homeValue != null ? `Home value ${formatMoney(property.homeValue)}` : "Home value unknown",
    property.squareFootage != null ? `Home ${formatNumber(property.squareFootage)} sqft` : "Home size unknown",
    ...(property.lotSize != null ? [`Lot ${formatNumber(property.lotSize)} sqft`] : []),
    financing.plan === "refinance"
      ? `Refinance ${pct(financing.refiRate, 2)} + loan ${pct(financing.unsecuredRate, 2)} / ${financing.unsecuredYears} yrs`
      : "Paid in cash",
  ];
}
