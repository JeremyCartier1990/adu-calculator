import { bedroomsForSqft } from "./assumptions";
import { headline, financingFor } from "./breakdown";
import { calculateEstimate, fallbackMonthlyRent } from "./calculate";
import { FINANCING } from "./financing";
import { bestSetup } from "./optimize";

/**
 * A made-up Los Angeles home run through the same model as a real report, so the
 * landing page can show what the report says without anyone's address.
 */
export const SAMPLE_PROPERTY = {
  label: "A 1,500 sqft Los Angeles home on a 6,000 sqft lot, worth $1.1M and owned outright, paid for with a cash-out refinance",
  homeSquareFootage: 1500,
  lotSize: 6000,
  homeValue: 1_100_000,
  mortgageBalance: 0,
  mortgageRate: null,
};

export function sampleReport() {
  const { homeSquareFootage, lotSize, homeValue, mortgageBalance, mortgageRate } = SAMPLE_PROPERTY;
  const setup = bestSetup({ homeSquareFootage, lotSize, homeValue });
  const estimate = calculateEstimate({
    ...setup,
    monthlyRent: fallbackMonthlyRent(setup.sqft, bedroomsForSqft(setup.sqft)),
    rentLow: null,
    rentHigh: null,
    rentSource: "assumption",
    homeSquareFootage,
    homeValue,
    lotSize,
    rentalUse: "long_term",
  });
  const financing = financingFor(
    {
      plan: "refinance",
      homeValue,
      mortgageBalance,
      currentRate: mortgageRate,
      currentPayment: null,
      refiRate: FINANCING.defaultRefiRate,
      refiRateAsOf: null,
      unsecuredRate: FINANCING.unsecuredRate,
    },
    estimate,
  );
  return { estimate, financing, summary: headline(estimate, financing) };
}
