import {
  ASSUMPTIONS,
  bedroomLabel,
  bedroomsForSqft,
  finishTitle,
  projectTitle,
  type FinishLevelId,
  type ProjectTypeId,
} from "./assumptions";
import { dollars, formatMoney } from "./money";

export type RentSource = "rentcast" | "assumption" | "manual";

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
};

export type CashPoint = {
  year: number;
  net: number;
  cumulative: number;
};

export type YearOne = {
  gross: number;
  vacancy: number;
  maintenance: number;
  insurance: number;
  propertyTax: number;
  net: number;
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
  design: number;
  cityFees: number;
  schoolFees: number;
  utilityFees: number;
  permitsAndFees: number;
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
};

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

type YearParts = YearOne;

function yearParts(year: number, sqft: number, monthlyRent: number, total: number): YearParts {
  const ops = ASSUMPTIONS.operations;
  const rentGrowth = (1 + ops.rentGrowthRate) ** (year - 1);
  const expenseGrowth = (1 + ops.expenseGrowthRate) ** (year - 1);
  const taxGrowth = (1 + ops.propertyTaxGrowthRate) ** (year - 1);
  const gross = dollars(monthlyRent * 12 * rentGrowth);
  const vacancy = dollars(gross * ops.vacancyRate);
  const maintenance = dollars(gross * ops.maintenanceRate);
  const insurance = dollars(sqft * ops.insurancePerSqftYear * expenseGrowth);
  const propertyTax = dollars(total * ops.propertyTaxRate * taxGrowth);
  return {
    gross,
    vacancy,
    maintenance,
    insurance,
    propertyTax,
    net: gross - vacancy - maintenance - insurance - propertyTax,
  };
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
  const count = (bedrooms < 0 ? 0 : bedrooms > 3 ? 3 : bedrooms) as 0 | 1 | 2 | 3;
  const rate = ASSUMPTIONS.rent.fallbackMonthlyPerSqft[count];
  return dollars(clampSqft(sqft) * rate);
}

export function calculateEstimate(input: EstimateInput): Estimate {
  const projectType = input.projectType;
  const finish = input.finish;
  const sqft = clampSqft(input.sqft);
  const bedrooms = bedroomsForSqft(sqft);
  const monthlyRent =
    Number.isFinite(input.monthlyRent) && input.monthlyRent > 0 ? dollars(input.monthlyRent) : 0;

  const constructionRate = ASSUMPTIONS.costPerSqft[projectType][finish];
  const designRate = ASSUMPTIONS.design[finish];
  const construction = dollars(sqft * constructionRate);
  const design = dollars(designRate.base + designRate.perSqft * sqft);
  const cityFees = dollars(
    ASSUMPTIONS.permits.cityPermitBase + ASSUMPTIONS.permits.cityPermitPerSqft * sqft,
  );
  const schoolFees =
    sqft >= ASSUMPTIONS.permits.impactFeeExemptBelowSqft
      ? dollars(sqft * ASSUMPTIONS.permits.schoolFeePerSqft)
      : 0;
  const utilityFees = ASSUMPTIONS.permits.utilityConnection[projectType];
  const permitsAndFees = cityFees + schoolFees + utilityFees;
  const total = construction + design + permitsAndFees;

  const years = ASSUMPTIONS.operations.projectionYears;
  const series: CashPoint[] = [{ year: 0, net: 0, cumulative: -total }];
  let cumulative = -total;
  let yearOne: YearParts | null = null;
  for (let year = 1; year <= years; year += 1) {
    const parts = yearParts(year, sqft, monthlyRent, total);
    if (year === 1) yearOne = parts;
    cumulative += parts.net;
    series.push({ year, net: parts.net, cumulative });
  }
  if (!yearOne) {
    yearOne = yearParts(1, sqft, monthlyRent, total);
  }

  const annualNet = yearOne.net;
  const monthlyNet = dollars(annualNet / 12);
  const simplePaybackYears = annualNet > 0 ? total / annualNet : null;
  const breakEvenYears = annualNet > 0 ? breakEvenYear(series) : null;

  const homeSize = usableHomeSize(input.homeSquareFootage);
  const homeValue = usableHomeValue(input.homeValue);
  const providedBoth = homeSize != null && homeValue != null;
  const valuePerSqftExact = providedBoth
    ? homeValue / homeSize
    : ASSUMPTIONS.value.fallbackValuePerSqft;
  const factor = ASSUMPTIONS.value.sqftFactor[projectType];
  const sqftUplift = dollars(valuePerSqftExact * sqft * factor);
  const incomeUplift = annualNet > 0 ? dollars(annualNet / ASSUMPTIONS.value.capRate) : null;
  const weight = ASSUMPTIONS.value.sqftApproachWeight;
  const blendedUplift =
    incomeUplift == null ? sqftUplift : dollars(weight * sqftUplift + (1 - weight) * incomeUplift);
  const equity = blendedUplift - total;
  const newHomeValue = homeValue != null ? homeValue + blendedUplift : null;

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
    warnings.push("At this rent and these expenses, the ADU does not show positive income, so there is no payback period.");
  }

  const ops = ASSUMPTIONS.operations;
  const notes = [
    `Construction uses ${formatMoney(constructionRate)} per square foot for a ${finishTitle(finish).toLowerCase()} ${projectTitle(projectType).toLowerCase()} (hard cost only).`,
    `Architectural plans are ${formatMoney(designRate.base)} plus ${formatMoney(designRate.perSqft)} per square foot.`,
    `City permits are ${formatMoney(ASSUMPTIONS.permits.cityPermitBase)} plus ${formatMoney(ASSUMPTIONS.permits.cityPermitPerSqft)} per square foot. Utility connections are ${formatMoney(utilityFees)} for this project type.`,
    schoolFees === 0
      ? `School and impact fees are $0 because this ADU is under ${ASSUMPTIONS.permits.impactFeeExemptBelowSqft} sqft.`
      : `School and impact fees are ${formatMoney(ASSUMPTIONS.permits.schoolFeePerSqft)} per square foot because this ADU is ${ASSUMPTIONS.permits.impactFeeExemptBelowSqft} sqft or larger.`,
    `Vacancy is ${Math.round(ops.vacancyRate * 100)}% of gross rent. Maintenance is ${Math.round(ops.maintenanceRate * 100)}% of gross rent. Insurance is ${formatMoney(ops.insurancePerSqftYear)} per square foot per year.`,
    `Added property tax is ${(ops.propertyTaxRate * 100).toFixed(1)}% of total project cost in year one, then grows at ${Math.round(ops.propertyTaxGrowthRate * 100)}% a year. Insurance grows at ${ops.expenseGrowthRate * 100}%. Rent grows at ${Math.round(ops.rentGrowthRate * 100)}%.`,
    `The chart's payback is the year cumulative cash flow crosses zero. Simple payback is total cost divided by year-one net income, with no growth.`,
    `Added value blends ${Math.round(weight * 100)}% of the square-foot approach (${Math.round(factor * 100)}% of home value per square foot × ADU size) with ${Math.round((1 - weight) * 100)}% of the income approach (year-one net income ÷ a ${(ASSUMPTIONS.value.capRate * 100).toFixed(1)}% cap rate). If net income is not positive, only the square-foot approach is used.`,
  ];

  return {
    projectType,
    projectLabel: projectTitle(projectType),
    finish,
    finishLabel: finishTitle(finish),
    sqft,
    bedrooms,
    bedroomLabel: bedroomLabel(bedrooms),
    construction,
    design,
    cityFees,
    schoolFees,
    utilityFees,
    permitsAndFees,
    total,
    monthlyRent,
    rentLow: input.rentLow,
    rentHigh: input.rentHigh,
    rentSource: input.rentSource,
    yearOne,
    annualNet,
    monthlyNet,
    simplePaybackYears,
    breakEvenYears,
    series,
    valuePerSqft: dollars(valuePerSqftExact),
    usedFallbackValuePerSqft: !providedBoth,
    sqftUplift,
    incomeUplift,
    blendedUplift,
    newHomeValue,
    equity,
    warnings,
    notes,
  };
}
