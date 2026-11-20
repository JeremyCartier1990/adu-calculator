import "server-only";

import { cacheLife } from "next/cache";

// Freddie Mac's weekly 30-year fixed average (Primary Mortgage Market Survey), via FRED. No key needed.
const SOURCE = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US";

export type MarketRate = { rate: number; asOf: string; source: "Freddie Mac PMMS" };

/** The latest weekly 30-year rate as a fraction, or null when FRED is unreachable. */
export async function latestMortgageRate(): Promise<MarketRate | null> {
  "use cache";
  cacheLife("hours");
  try {
    const response = await fetch(SOURCE, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const rows = (await response.text()).trim().split("\n");
    for (let index = rows.length - 1; index > 0; index -= 1) {
      const [asOf, value] = rows[index].split(",");
      const percent = Number(value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(asOf) && percent > 0 && percent < 30) {
        return { rate: Math.round(percent * 100) / 10000, asOf, source: "Freddie Mac PMMS" };
      }
    }
    return null;
  } catch {
    return null;
  }
}
