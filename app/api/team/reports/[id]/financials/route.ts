import { cookies } from "next/headers";
import { hasTeamAccess } from "@/lib/admin-auth";
import { fetchPropertyFinancials } from "@/lib/propertyreach";
import { enableSharedPropertyReachCache } from "@/lib/propertyreach-cache";
import { getReport } from "@/lib/report-store";

/**
 * The mortgage on record, to prefill the financing section in the team builder.
 * Team only: loan balances and lenders aren't shown to anyone who types an address.
 * The lookup reuses the stored PropertyReach answer, so it costs no extra credit.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/team/reports/[id]/financials">): Promise<Response> {
  if (!hasTeamAccess(await cookies())) return Response.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const report = await getReport((await params).id);
  if (!report) return Response.json({ ok: false, code: "not_found" }, { status: 404 });
  enableSharedPropertyReachCache();
  const { property } = report;
  const financials = report.financials ?? (await fetchPropertyFinancials(property.address, property.latitude, property.longitude));
  if (!financials) return Response.json({ ok: false, code: "no_data" });

  // One blended rate across open loans, weighted by balance.
  const rated = financials.loans.filter((loan) => loan.rate != null && (loan.estimatedBalance ?? loan.amount ?? 0) > 0);
  const weight = rated.reduce((sum, loan) => sum + (loan.estimatedBalance ?? loan.amount ?? 0), 0);
  const rate = weight > 0 ? rated.reduce((sum, loan) => sum + loan.rate! * (loan.estimatedBalance ?? loan.amount ?? 0), 0) / weight : null;
  return Response.json({
    ok: true,
    homeValue: financials.estimatedValue,
    mortgageBalance: financials.loanBalance ?? (financials.openLoanCount === 0 ? 0 : null),
    currentRate: rate == null ? null : Math.round(rate * 10000) / 10000,
    currentPayment: financials.monthlyPayment,
    openLoans: financials.openLoanCount,
  });
}
