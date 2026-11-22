import {
  ASSUMPTIONS,
  bedroomLabel,
  bedroomsForSqft,
  finishTitle,
  projectTitle,
  type BedroomCount,
  type FinishLevelId,
  type ProjectTypeId,
} from "./assumptions";
import { dollars, formatMoney } from "./money";

export type RentSource = "rentcast" | "assumption" | "manual";
export type RentalUse = "long_term" | "short_term";

export type EstimateInput = {
  projectType: ProjectTypeId;
  finish: FinishLevelId;
  sqft: number;
  monthlyRent: number;
  rentLow: number | null;
  rentHigh: number | null;
  rentSource: RentSource;
  homeSquareFootage: number | null;
  homeValue: number | null;
  lotSize: number | null;
  /** Which scenario drives payback, the chart, and the income approach. */
  rentalUse?: RentalUse;
  /** Null uses the Los Angeles default. */
  strOccupancy?: number | null;
  /** Null derives a nightly rate from the long-term rent. */
  strNightlyRate?: number | null;
};

export type CashPoint = {
  year: number;
  net: number;
  cumulative: number;
};

export type YearOne = {
  gross: number;
  vacancy: number;
  propertyTax: number;
  net: number;
};

export type ExpenseLine = {
  label: string;
  amount: number;
  hint?: string;
};

export type RentalScenario = {
  id: RentalUse;
  label: string;
  summary: string;
  sourceNote: string;
  monthlyGross: number;
  nightlyRate: number | null;
  occupancy: number | null;
  annualGross: number;
  lines: ExpenseLine[];
  annualNet: number;
  monthlyNet: number;
  simplePaybackYears: number | null;
  breakEvenYears: number | null;
  series: CashPoint[];
  incomeUplift: number | null;
};

export type Estimate = {
  projectType: ProjectTypeId;
  projectLabel: string;
  finish: FinishLevelId;
  finishLabel: string;
  sqft: number;
  bedrooms: number;
  bedroomLabel: string;
  construction: number;
  /** Finish materials, priced separately from construction. */
  materials: number;
  design: number;
  cityFees: number;
  total: number;
  monthlyRent: number;
  rentLow: number | null;
  rentHigh: number | null;
  rentSource: RentSource;
  yearOne: YearOne;
  annualNet: number;
  monthlyNet: number;
  simplePaybackYears: number | null;
  breakEvenYears: number | null;
  series: CashPoint[];
  valuePerSqft: number;
  usedFallbackValuePerSqft: boolean;
  sqftUplift: number;
  incomeUplift: number | null;
  blendedUplift: number;
  newHomeValue: number | null;
  equity: number;
  warnings: string[];
  notes: string[];
  rentalUse: RentalUse;
  scenarios: {
    longTerm: RentalScenario;
    shortTerm: RentalScenario;
  };
};

const marked = (cost: number) => cost * ASSUMPTIONS.cost.markup;

/** What the homeowner pays per square foot for construction and finish materials. */
export function constructionPrices(finish: FinishLevelId) {
  const build = marked(ASSUMPTIONS.cost.buildPerSqft[finish]);
  // Finish materials pass through at cost, with no markup.
  const finishes = ASSUMPTIONS.cost.finishPerSqft[finish];
  return { build, finishes, perSqft: build + finishes };
}

/** Architectural plans, priced along the size range. */
export function plansPrice(sqft: number): number {
  const { min, max } = ASSUMPTIONS.size;
  const { plans } = ASSUMPTIONS.cost;
  const share = (Math.min(max, Math.max(min, sqft)) - min) / (max - min);
  return dollars(marked(plans.min + (plans.max - plans.min) * share));
}

export function permitPrice(): number {
  return dollars(marked(ASSUMPTIONS.cost.permit));
}

function clampSqft(sqft: number): number {
  if (!Number.isFinite(sqft)) return ASSUMPTIONS.size.defaults.detached_adu;
  return Math.min(ASSUMPTIONS.size.max, Math.max(ASSUMPTIONS.size.min, sqft));
}

function usableHomeSize(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 200 || value > 20000) return null;
  return value;
}

function usableHomeValue(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 50000 || value > 50000000) return null;
  return value;
}

function breakEvenYear(series: CashPoint[]): number | null {
  for (let index = 1; index < series.length; index += 1) {
    const previous = series[index - 1]?.cumulative ?? 0;
    const current = series[index]?.cumulative ?? 0;
    if (current >= 0) {
      const delta = current - previous;
      const year = series[index - 1]?.year ?? 0;
      if (delta <= 0) return series[index]?.year ?? year;
      return year + -previous / delta;
    }
  }
  return null;
}

export function fallbackMonthlyRent(sqft: number, bedrooms: number): number {
  const count = bedroomCount(bedrooms);
  const rate = ASSUMPTIONS.rent.fallbackMonthlyPerSqft[count];
  return dollars(clampSqft(sqft) * rate);
}

type UnitSize = { sqft: number; bedrooms: number };

/** A rent measured for one unit, carried to another size along the planning rates' curve. */
export function scaleRent(rent: number, from: UnitSize, to: UnitSize): number {
  const base = fallbackMonthlyRent(from.sqft, from.bedrooms);
  return base > 0 ? dollars((rent * fallbackMonthlyRent(to.sqft, to.bedrooms)) / base) : rent;
}

/** A nightly rate measured for one bedroom count, carried to another with the planning nightly rates. */
export function scaleNightlyRate(rate: number, fromBedrooms: number, toBedrooms: number): number {
  const table = ASSUMPTIONS.shortTerm.fallbackNightlyRate;
  return dollars((rate * table[bedroomCount(toBedrooms)]) / table[bedroomCount(fromBedrooms)]);
}

function bedroomCount(bedrooms: number): BedroomCount {
  if (bedrooms <= 0) return 0;
  if (bedrooms >= 3) return 3;
  return Math.round(bedrooms) as BedroomCount;
}

function percentLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function clampOccupancy(occupancy: number): number {
  const { occupancyMin, occupancyMax, defaultOccupancy } = ASSUMPTIONS.shortTerm;
  if (!Number.isFinite(occupancy)) return defaultOccupancy;
  return Math.min(occupancyMax, Math.max(occupancyMin, occupancy));
}

/** Nightly rate from the long-term monthly rent, or a bedroom fallback when rent is missing. */
export function deriveNightlyRate(monthlyLongTermRent: number, bedrooms: number): number {
  const { daysPerMonth, nightlyFromMonthlyMultiplier, fallbackNightlyRate } = ASSUMPTIONS.shortTerm;
  if (Number.isFinite(monthlyLongTermRent) && monthlyLongTermRent > 0) {
    return dollars((monthlyLongTermRent / daysPerMonth) * nightlyFromMonthlyMultiplier);
  }
  return fallbackNightlyRate[bedroomCount(bedrooms)];
}

/** Monthly short-term gross = nightly rate × 30.4 × occupancy. */
export function shortTermMonthlyGross(nightlyRate: number, occupancy: number): number {
  return dollars(nightlyRate * ASSUMPTIONS.shortTerm.daysPerMonth * clampOccupancy(occupancy));
}

type YearFlow = {
  gross: number;
  lines: ExpenseLine[];
  net: number;
};

function longTermYear(year: number, monthlyRent: number, total: number): YearFlow {
  const ops = ASSUMPTIONS.operations;
  const rentGrowth = (1 + ops.rentGrowthRate) ** (year - 1);
  const taxGrowth = (1 + ops.propertyTaxGrowthRate) ** (year - 1);
  const gross = dollars(monthlyRent * 12 * rentGrowth);
  const vacancy = dollars(gross * ops.vacancyRate);
  const propertyTax = dollars(total * ops.propertyTaxRate * taxGrowth);
  const lines: ExpenseLine[] = [
    { label: "Vacancy", amount: vacancy, hint: `${percentLabel(ops.vacancyRate)} of gross` },
    { label: "Added property tax", amount: propertyTax, hint: "1.2% of project cost" },
  ];
  return {
    gross,
    lines,
    net: gross - vacancy - propertyTax,
  };
}

function shortTermYear(
  year: number,
  total: number,
  nightlyRate: number,
  occupancy: number,
): YearFlow {
  const str = ASSUMPTIONS.shortTerm;
  const ops = ASSUMPTIONS.operations;
  const rentGrowth = (1 + ops.rentGrowthRate) ** (year - 1);
  const taxGrowth = (1 + ops.propertyTaxGrowthRate) ** (year - 1);
  const monthlyGross = dollars(nightlyRate * str.daysPerMonth * occupancy);
  const gross = dollars(monthlyGross * 12 * rentGrowth);
  const management = dollars(gross * str.managementRate);
  const propertyTax = dollars(total * ops.propertyTaxRate * taxGrowth);
  const lines: ExpenseLine[] = [
    { label: "Management", amount: management, hint: `${percentLabel(str.managementRate)} of gross` },
    { label: "Added property tax", amount: propertyTax, hint: "1.2% of project cost" },
  ];
  const net = gross - lines.reduce((sum, line) => sum + line.amount, 0);
  return { gross, lines, net };
}

function projectScenario(
  total: number,
  yearFlow: (year: number) => YearFlow,
): Pick<
  RentalScenario,
  "annualGross" | "lines" | "annualNet" | "monthlyNet" | "simplePaybackYears" | "breakEvenYears" | "series"
> {
  const years = ASSUMPTIONS.operations.projectionYears;
  const series: CashPoint[] = [{ year: 0, net: 0, cumulative: -total }];
  let cumulative = -total;
  let first: YearFlow | null = null;
  for (let year = 1; year <= years; year += 1) {
    const flow = yearFlow(year);
    if (year === 1) first = flow;
    cumulative += flow.net;
    series.push({ year, net: flow.net, cumulative });
  }
  const annualNet = first?.net ?? 0;
  const annualGross = first?.gross ?? 0;
  return {
    annualGross,
    lines: first?.lines ?? [],
    annualNet,
    monthlyNet: dollars(annualNet / 12),
    simplePaybackYears: annualNet > 0 ? total / annualNet : null,
    breakEvenYears: annualNet > 0 ? breakEvenYear(series) : null,
    series,
  };
}

export function calculateEstimate(input: EstimateInput): Estimate {
  const projectType = input.projectType;
  const finish = input.finish;
  const sqft = clampSqft(input.sqft);
  const bedrooms = bedroomsForSqft(sqft);
  const monthlyRent =
    Number.isFinite(input.monthlyRent) && input.monthlyRent > 0 ? dollars(input.monthlyRent) : 0;

  const prices = constructionPrices(finish);
  const construction = dollars(sqft * prices.build);
  const materials = dollars(sqft * prices.finishes);
  const design = plansPrice(sqft);
  const cityFees = permitPrice();
  const total = construction + materials + design + cityFees;

  const rentalUse = input.rentalUse ?? "long_term";
  const occupancy = clampOccupancy(input.strOccupancy ?? ASSUMPTIONS.shortTerm.defaultOccupancy);
  const nightlyRate =
    input.strNightlyRate != null && input.strNightlyRate > 0
      ? dollars(input.strNightlyRate)
      : deriveNightlyRate(monthlyRent, bedrooms);
  const strMonthly = shortTermMonthlyGross(nightlyRate, occupancy);

  const longTermFlow = projectScenario(total, (year) => longTermYear(year, monthlyRent, total));
  const shortTermFlow = projectScenario(total, (year) =>
    shortTermYear(year, total, nightlyRate, occupancy),
  );
  const longTermYearOne = longTermYear(1, monthlyRent, total);
  const yearOne: YearOne = {
    gross: longTermYearOne.gross,
    vacancy: longTermYearOne.lines[0]?.amount ?? 0,
    propertyTax: longTermYearOne.lines[1]?.amount ?? 0,
    net: longTermYearOne.net,
  };

  const homeSize = usableHomeSize(input.homeSquareFootage);
  const homeValue = usableHomeValue(input.homeValue);
  const providedBoth = homeSize != null && homeValue != null;
  const valuePerSqftExact = providedBoth
    ? homeValue / homeSize
    : ASSUMPTIONS.value.fallbackValuePerSqft;
  const factor = ASSUMPTIONS.value.sqftFactor[projectType];
  const sqftUplift = dollars(valuePerSqftExact * sqft * factor);
  const weight = ASSUMPTIONS.value.sqftApproachWeight;
  const capRate = ASSUMPTIONS.value.capRate;
  const incomeFor = (annualNet: number) => (annualNet > 0 ? dollars(annualNet / capRate) : null);
  const blendFor = (incomeUplift: number | null) =>
    incomeUplift == null ? sqftUplift : dollars(weight * sqftUplift + (1 - weight) * incomeUplift);

  const longTermIncome = incomeFor(longTermFlow.annualNet);
  const shortTermIncome = incomeFor(shortTermFlow.annualNet);
  const activeFlow = rentalUse === "short_term" ? shortTermFlow : longTermFlow;
  const incomeUplift = rentalUse === "short_term" ? shortTermIncome : longTermIncome;
  const blendedUplift = blendFor(incomeUplift);
  const equity = blendedUplift - total;
  const newHomeValue = homeValue != null ? homeValue + blendedUplift : null;
  const annualNet = activeFlow.annualNet;

  const warnings: string[] = [];
  if (!providedBoth) {
    warnings.push(
      `Price per square foot is the $${ASSUMPTIONS.value.fallbackValuePerSqft.toLocaleString("en-US")} Los Angeles fallback until both home size and home value are set.`,
    );
  } else if (
    (input.homeSquareFootage != null && homeSize == null) ||
    (input.homeValue != null && homeValue == null)
  ) {
    warnings.push("Check the home size and value. One of them was outside a usable range, so the fallback price per square foot is in use.");
  }
  if (
    projectType === "detached_adu" &&
    input.lotSize != null &&
    input.lotSize > 0 &&
    input.lotSize < ASSUMPTIONS.lot.tightDetachedBelowSqft
  ) {
    warnings.push(
      "This lot is tight for a detached cottage. Setbacks can shrink the footprint — a garage conversion or an attached suite may fit more easily.",
    );
  }
  if (projectType === "garage_conversion" && sqft > ASSUMPTIONS.lot.largeGarageAboveSqft) {
    warnings.push(
      "Above about 700 sqft is often an addition, not a straight garage conversion. The cost may land closer to an attached ADU.",
    );
  }
  if (annualNet <= 0) {
    warnings.push(
      rentalUse === "short_term"
        ? "At this nightly rate, occupancy, and these expenses, the short-term rental does not show positive income, so there is no payback period."
        : "At this rent and these expenses, the long-term lease does not show positive income, so there is no payback period.",
    );
  }

  const ops = ASSUMPTIONS.operations;
  const notes = [
    `At the ${finishTitle(finish).toLowerCase()} finish, construction is ${formatMoney(prices.build)} per square foot and finish materials are ${formatMoney(prices.finishes)} per square foot.`,
    `Architectural plans are ${formatMoney(plansPrice(ASSUMPTIONS.size.min))} to ${formatMoney(plansPrice(ASSUMPTIONS.size.max))}, depending on size.`,
    `City permits are about ${formatMoney(permitPrice())}; the exact fee depends on the city.`,
    `Long-term rent is a 12-month lease. Maintenance, utilities and insurance aren't included. Vacancy is ${percentLabel(ops.vacancyRate)} of gross rent.`,
    `Short-term gross is nightly rate × ${ASSUMPTIONS.shortTerm.daysPerMonth} × occupancy. The default nightly rate is ${ASSUMPTIONS.shortTerm.nightlyFromMonthlyMultiplier}× the long-term monthly rent divided by ${ASSUMPTIONS.shortTerm.daysPerMonth} days. Default occupancy is ${percentLabel(ASSUMPTIONS.shortTerm.defaultOccupancy)}. Revenue is after the platform's fee. Management is ${percentLabel(ASSUMPTIONS.shortTerm.managementRate)}. Cleaning, supplies, repairs, utilities and insurance aren't included: guests usually pay a cleaning fee, and the rest varies by owner. This is a planning estimate, not RentCast data.`,
    `Added property tax is ${(ops.propertyTaxRate * 100).toFixed(1)}% of total project cost in year one, then grows at ${Math.round(ops.propertyTaxGrowthRate * 100)}% a year. Rent grows at ${Math.round(ops.rentGrowthRate * 100)}%.`,
    `The chart's payback is the year cumulative cash flow crosses zero. Simple payback is total cost divided by year-one net income, with no growth.`,
    `Added value blends ${Math.round(weight * 100)}% of the square-foot approach (${Math.round(factor * 100)}% of home value per square foot × ADU size) with ${Math.round((1 - weight) * 100)}% of the income approach (year-one net income for the selected rental ÷ a ${(capRate * 100).toFixed(1)}% cap rate). If that net income is not positive, only the square-foot approach is used.`,
    "Short-term rentals of ADUs may be restricted. Los Angeles's home-sharing ordinance limits registration, primary-residence use, and night caps. Confirm the rules for the address before counting on nightly income.",
  ];

  const rentSourceNote =
    input.rentSource === "rentcast"
      ? "RentCast long-term rent estimate"
      : input.rentSource === "manual"
        ? "Long-term rent you entered"
        : "Los Angeles planning rate for a 12-month lease";

  const longTerm: RentalScenario = {
    id: "long_term",
    label: "Long-term rent (12-month lease)",
    summary: "Gross monthly rent",
    sourceNote: rentSourceNote,
    monthlyGross: monthlyRent,
    nightlyRate: null,
    occupancy: null,
    incomeUplift: longTermIncome,
    ...longTermFlow,
  };
  const shortTerm: RentalScenario = {
    id: "short_term",
    label: `Short-term rental (nightly, ${percentLabel(occupancy)} occupancy)`,
    summary: "Gross monthly revenue",
    sourceNote: "Planning estimate, not RentCast data",
    monthlyGross: strMonthly,
    nightlyRate,
    occupancy,
    incomeUplift: shortTermIncome,
    ...shortTermFlow,
  };

  return {
    projectType,
    projectLabel: projectTitle(projectType),
    finish,
    finishLabel: finishTitle(finish),
    sqft,
    bedrooms,
    bedroomLabel: bedroomLabel(bedrooms),
    construction,
    materials,
    design,
    cityFees,
    total,
    monthlyRent,
    rentLow: input.rentLow,
    rentHigh: input.rentHigh,
    rentSource: input.rentSource,
    yearOne,
    annualNet,
    monthlyNet: activeFlow.monthlyNet,
    simplePaybackYears: activeFlow.simplePaybackYears,
    breakEvenYears: activeFlow.breakEvenYears,
    series: activeFlow.series,
    valuePerSqft: dollars(valuePerSqftExact),
    usedFallbackValuePerSqft: !providedBoth,
    sqftUplift,
    incomeUplift,
    blendedUplift,
    newHomeValue,
    equity,
    warnings,
    notes,
    rentalUse,
    scenarios: { longTerm, shortTerm },
  };
}
