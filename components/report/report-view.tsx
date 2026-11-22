import { CashFlowChart } from "@/components/cash-flow-chart";
import { Eyebrow } from "@/components/eyebrow";
import { CalculationBreakdown } from "@/components/report/calculation-breakdown";
import { InvestmentSummary } from "@/components/report/investment-summary";
import { ReportMeeting } from "@/components/funnel/schedule-call";
import { LotMap } from "@/components/report/lot-map";
import { BRAND } from "@/lib/brand";
import { breakdownSteps, financingFor, headline, settingsUsed } from "@/lib/breakdown";
import type { RentalScenario } from "@/lib/calculate";
import { formatMoney, formatNumber, formatYears } from "@/lib/money";
import type { PropertyFinancials } from "@/lib/propertyreach";
import { cashOnCash, estimateReport, formatPercent, type ReportRecord } from "@/lib/report";

const FACT_LABELS: Record<string, string> = {
  squareFootage: "Home size",
  lotSize: "Lot size",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  yearBuilt: "Year built",
  propertyType: "Property type",
  homeValue: "Estimated value",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" });
}

function Section({ title, n, children }: { title: string; n?: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5 font-display text-2xl text-ink">
        {n ? <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-sans text-[11px] font-semibold tabular-nums tracking-normal text-ink-soft">{n}</span> : null}
        {title}
      </h2>
      <div className="mt-3 border-t border-line pt-1">{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: Array<[string, string, boolean?]> }) {
  return (
    <dl>
      {rows.map(([label, value, strong]) => (
        <div key={label} className={`flex items-baseline justify-between gap-4 py-2 ${strong ? "mt-1 border-t border-line pt-3 font-semibold" : ""}`}>
          <dt className={strong ? "" : "text-ink-soft"}>{label}</dt>
          <dd className="tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Read-only report, rendered on the server from the saved inputs. Contact details show for the team only. */
export function ReportView({ report, showContact }: { report: ReportRecord; showContact: boolean }) {
  const { property, inputs } = report;
  const estimate = inputs ? estimateReport(inputs) : null;
  const financing = estimate ? financingFor(inputs?.financing, estimate) : null;
  const fact = (key: keyof typeof property) => {
    const value = property[key];
    if (value == null) return "—";
    if (key === "homeValue") return formatMoney(value as number);
    if (key === "squareFootage" || key === "lotSize") return `${formatNumber(value as number)} sqft`;
    return String(value);
  };
  const knownFacts = (Object.keys(FACT_LABELS) as Array<keyof typeof property>)
    .filter((key) => property[key] != null)
    .map((key): [string, string] => [FACT_LABELS[key], fact(key)]);

  return (
    <article className={`mx-auto max-w-6xl space-y-5 px-3 py-8 sm:px-4 sm:py-12 ${showContact ? "" : "pb-28 sm:pb-28"}`}>
      <header className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-col lg:flex-row">
          <div className="flex flex-1 flex-col justify-between gap-8 p-6 sm:p-10">
            <div>
              <Eyebrow>ADU ROI report</Eyebrow>
              <h1 className="mt-5 font-display text-3xl leading-[1.05] text-ink sm:text-5xl">{property.address}</h1>
              <p className="mt-3 text-sm text-ink-soft">
                Updated {formatDate(report.updatedAt)} · Report {report.id.slice(0, 8)}
              </p>
            </div>
            <a
              href={`/r/${report.id}/pdf`}
              className="no-print inline-flex min-h-12 w-fit items-center gap-3 rounded-lg bg-ink py-2 pl-5 pr-2 text-sm font-semibold text-white hover:bg-ink/85"
            >
              Download PDF
              <span className="grid h-8 w-8 place-items-center rounded-md bg-white/15" aria-hidden="true">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" />
                </svg>
              </span>
            </a>
          </div>
        </div>
        {estimate && financing ? (
          <div className="bg-ink p-5 sm:p-8 lg:p-10">
            <InvestmentSummary estimate={estimate} summary={headline(estimate, financing)} />
          </div>
        ) : null}
      </header>

      {showContact ? null : <ReportMeeting reportId={report.id} />}

      {showContact ? (
        <Section title="Lead">
          <Rows
            rows={[
              ["Name", report.name],
              ["Email", report.email ?? "Not given"],
              ["Phone", report.phone ? `${report.phone}${report.phoneVerified ? " · verified by text" : " · not verified"}` : "Not given"],
              ["Created by", report.createdBy === "team" ? "Team builder" : "Homeowner"],
              ["Created", formatDate(report.createdAt)],
              ["Property data", property.source === "rentcast" ? `Public records${property.edited.length ? `, homeowner edited ${property.edited.map((key) => FACT_LABELS[key] ?? key).join(", ").toLowerCase()}` : ", confirmed as is"}` : "Entered by homeowner"],
            ]}
          />
        </Section>
      ) : null}

      <Section title="Site plan">
        <LotMap
          address={property.address}
          latitude={property.latitude}
          longitude={property.longitude}
          footprint={inputs?.footprint ?? null}
          targetSqft={inputs?.sqft ?? 0}
        />
      </Section>

      {showContact && report.financials ? <Financials financials={report.financials} /> : null}

      {estimate && financing ? (
        <>
          <section className="rounded-xl border border-line bg-paper p-5 sm:p-6">
            <CalculationBreakdown steps={breakdownSteps(estimate, financing)} settings={settingsUsed(estimate, financing, property)} notes={estimate.notes} />
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <Section title="Property">
              {knownFacts.length > 0 ? (
                <Rows rows={knownFacts} />
              ) : (
                <p className="py-2 text-sm text-ink-soft">No public records were found for this address.</p>
              )}
            </Section>
            <Section title="Rental returns">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-soft">
                      <th className="py-2 font-medium" />
                      <th className="py-2 text-right font-medium">Lease</th>
                      <th className="py-2 text-right font-medium">Short-term</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {(
                      [
                        ["Gross / month", (x) => formatMoney(x.monthlyGross)],
                        ["Net / month", (x) => formatMoney(x.monthlyNet)],
                        ["After loans / month", (x) => formatMoney(x.monthlyNet - financing.monthlyDebt)],
                        ["Cash-on-cash", (x) => formatPercent(cashOnCash(x.annualNet, estimate.total))],
                        ["Payback with rent growth", (x) => formatYears(x.breakEvenYears)],
                      ] as Array<[string, (x: RentalScenario) => string]>
                    ).map(([label, value]) => (
                      <tr key={label} className="border-t border-line">
                        <td className="py-2 text-ink-soft">{label}</td>
                        <td className="py-2 text-right">{value(estimate.scenarios.longTerm)}</td>
                        <td className="py-2 text-right">{value(estimate.scenarios.shortTerm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>

          <Section title="15-year cash flow">
            <div className="pt-3">
              <CashFlowChart scenarios={[estimate.scenarios.longTerm, estimate.scenarios.shortTerm]} />
            </div>
          </Section>
        </>
      ) : (
        <Section title="Property">
          <p className="text-sm text-ink-soft">The homeowner confirmed the property but hasn&apos;t chosen an ADU yet.</p>
          <Rows rows={knownFacts} />
        </Section>
      )}

      <p className="text-xs leading-5 text-ink-soft">
        Estimates, not a bid. Costs, rent, taxes, and value will vary; confirm them with a licensed contractor, a designer, and a tax
        advisor. Prepared by {BRAND.name} ({BRAND.domain}) with {BRAND.builder}.
      </p>
    </article>
  );
}

const money = (value: number | null) => (value == null ? "—" : formatMoney(value));
const percent = (value: number | null, digits = 0) => (value == null ? "—" : `${(value * 100).toFixed(digits)}%`);

/** Team-only: mortgage and equity from public records, to talk financing with the homeowner. */
function Financials({ financials }: { financials: PropertyFinancials }) {
  return (
    <Section title="Mortgage & equity">
      <div className="grid gap-x-8 md:grid-cols-2">
        <Rows
          rows={[
            ["Estimated value", money(financials.estimatedValue)],
            ["Loan balance", money(financials.loanBalance)],
            ["Loan-to-value", percent(financials.loanToValue)],
            ["Estimated equity", money(financials.estimatedEquity), true],
          ]}
        />
        <Rows
          rows={[
            ["Credit-line room at 80% CLTV", money(financials.helocCapacity)],
            ["Mortgage payment", financials.monthlyPayment == null ? "—" : `${formatMoney(financials.monthlyPayment)} / mo`],
            ["Owner occupied", financials.ownerOccupied == null ? "—" : financials.ownerOccupied ? "Yes" : "No"],
            ["Owner of record", financials.ownerNames ?? "—"],
            ["Last sale", financials.lastSaleAmount == null ? "—" : `${formatMoney(financials.lastSaleAmount)}${financials.lastSaleDate ? ` · ${financials.lastSaleDate}` : ""}`],
            ["Property tax", financials.annualTax == null ? "—" : `${formatMoney(Math.round(financials.annualTax))} / yr`],
          ]}
        />
      </div>
      {financials.loans.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-soft">
                {["Lender", "Type", "Rate", "Original", "Est. balance", "Recorded"].map((label) => (
                  <th key={label} className="py-2 pr-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {financials.loans.map((loan, index) => (
                <tr key={index} className="border-t border-line">
                  <td className="py-2 pr-3">{loan.lender ?? "—"}</td>
                  <td className="py-2 pr-3 text-ink-soft">{[loan.loanType, loan.rateType].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="py-2 pr-3">{percent(loan.rate, 2)}</td>
                  <td className="py-2 pr-3">{money(loan.amount)}</td>
                  <td className="py-2 pr-3">{money(loan.estimatedBalance)}</td>
                  <td className="py-2 pr-3 text-ink-soft">{loan.recordingDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-ink-soft">
        From PropertyReach public records, {formatDate(financials.fetchedAt)}. Balances are estimates. Visible to the team only.
      </p>
    </Section>
  );
}
