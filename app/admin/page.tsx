import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { AdminLogin, SignOut } from "@/components/admin/session-controls";
import { Logo } from "@/components/brand";
import { formatDate } from "@/components/report/report-view";
import { ADMIN_COOKIE_NAME, adminConfigured, isAdminToken } from "@/lib/admin-auth";
import { projectTitle } from "@/lib/assumptions";
import { formatMoney } from "@/lib/money";
import { cashOnCash, estimateReport, formatPercent } from "@/lib/report";
import { listReports } from "@/lib/report-store";

export const metadata: Metadata = {
  title: "Leads | ADU ROI Calculator",
  robots: { index: false, follow: false },
};

async function Leads() {
  // Session checks read the clock, so this renders per request.
  await connection();
  const cookieStore = await cookies();
  if (!adminConfigured()) {
    return <p className="mx-auto mt-16 max-w-md text-center text-sm text-ink-soft">Set ADMIN_PASSWORD (10+ characters) to enable this dashboard.</p>;
  }
  if (!isAdminToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) return <AdminLogin />;

  const reports = await listReports();
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Leads</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {reports.length} saved {reports.length === 1 ? "report" : "reports"}, newest first. Each row opens the homeowner&apos;s latest
            choices.
          </p>
        </div>
        <SignOut />
      </div>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              {["Created", "Homeowner", "Property", "Equity", "ADU", "Cost", "Net / mo", "Cash-on-cash", ""].map((label) => (
                <th key={label} className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const estimate = report.inputs ? estimateReport(report.inputs) : null;
              return (
                <tr key={report.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(report.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {report.name}
                      {report.createdBy === "team" ? (
                        <span className="ml-2 rounded bg-ink/[0.06] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Team</span>
                      ) : null}
                    </p>
                    {report.email ? (
                      <p className="text-ink-soft">
                        <a href={`mailto:${report.email}`} className="hover:underline">
                          {report.email}
                        </a>
                      </p>
                    ) : null}
                    {report.phone ? (
                      <p className="text-ink-soft">
                        <a href={`tel:${report.phone}`} className="hover:underline">
                          {report.phone}
                        </a>
                        {report.phoneVerified ? <span className="ml-1.5 text-good">✓ verified</span> : null}
                      </p>
                    ) : null}
                  </td>
                  <td className="max-w-[260px] px-4 py-3">{report.property.address}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                    {report.financials?.estimatedEquity != null ? (
                      <>
                        {formatMoney(report.financials.estimatedEquity)}
                        <span className="block text-xs text-ink-soft">
                          {report.financials.loanToValue != null ? `${Math.round(report.financials.loanToValue * 100)}% LTV` : "No loan data"}
                          {report.financials.helocCapacity != null ? ` · ${formatMoney(report.financials.helocCapacity)} line room` : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {estimate ? `${projectTitle(estimate.projectType)} · ${estimate.sqft} sqft` : <span className="text-ink-soft">Not chosen yet</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{estimate ? formatMoney(estimate.total) : "—"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {estimate ? formatMoney(estimate.scenarios.longTerm.monthlyNet) : "—"}
                    {estimate ? <span className="block text-xs text-ink-soft">Short-term {formatMoney(estimate.scenarios.shortTerm.monthlyNet)}</span> : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{estimate ? formatPercent(cashOnCash(estimate.scenarios.longTerm.annualNet, estimate.total)) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link href={`/r/${report.id}`} className="font-medium text-pine hover:underline">
                      Open report
                    </Link>
                  </td>
                </tr>
              );
            })}
            {reports.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-ink-soft">
                  No reports yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="min-h-svh">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center px-4">
          <Link href="/">
            <Logo />
          </Link>
        </div>
      </header>
      <Suspense fallback={<p className="mx-auto mt-16 max-w-md text-center text-sm text-ink-soft">Loading…</p>}>
        <Leads />
      </Suspense>
    </div>
  );
}
