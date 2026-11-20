import { latestMortgageRate } from "@/lib/market-rate";

/** Today's 30-year refinance benchmark for the financing section. */
export async function GET(): Promise<Response> {
  const market = await latestMortgageRate();
  return Response.json({ ok: market != null, market });
}
