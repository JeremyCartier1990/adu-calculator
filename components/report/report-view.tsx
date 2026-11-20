import { CashFlowChart } from "@/components/cash-flow-chart";
import { Eyebrow } from "@/components/eyebrow";
import { Kpi, KpiBand } from "@/components/report/kpi";
import { PropertyMap } from "@/components/report/property-map";
import { bedroomLabel } from "@/lib/assumptions";
import { BRAND } from "@/lib/brand";
import { calculateEstimate, type RentalScenario } from "@/lib/calculate";
import { formatMoney, formatNumber, formatYears } from "@/lib/money";
import type { PropertyFinancials } from "@/lib/propertyreach";
import { cashOnCash, formatPercent, type ReportRecord } from "@/lib/report";

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
  const estimate = inputs ? calculateEstimate(inputs) : null;
  const active = estimate ? (estimate.rentalUse === "short_term" ? estimate.scenarios.shortTerm : estimate.scenarios.longTerm) : null;
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
    <article className="mx-auto max-w-6xl space-y-5 px-3 py-8 sm:px-4 sm:py-12">
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
          <PropertyMap
            address={property.address}
            latitude={property.latitude}
            longitude={property.longitude}
            className="m-3 mt-0 aspect-[16/10] lg:m-3 lg:aspect-auto lg:min-h-72 lg:w-[44%]"
          />
        </div>
        {estimate && active ? (
          <div className="bg-ink p-3 sm:p-4">
            <KpiBand>
              <Kpi label="Project cost" value={formatMoney(estimate.total)} wide />
              <Kpi label="Net income / mo" value={formatMoney(active.monthlyNet)} note={active.label} />
              <Kpi label="Cash-on-cash" value={formatPercent(cashOnCash(active.annualNet, estimate.total))} note="Year-one net ÷ cost" />
              <Kpi label="Payback" value={formatYears(active.breakEvenYears)} note="With rent growth" />
              <Kpi label="Equity created" value={formatMoney(estimate.equity)} tone={estimate.equity >= 0 ? "good" : "warn"} note="Value added − cost" />
            </KpiBand>
          </div>
        ) : null}
      </header>

      {showContact ? (
        <Section title="Lead">
          <Rows
            rows={[
              ["Name", report.name],
              ["Email", report.email ?? "Not given"],
              ["Phone", `${report.phone}${report.phoneVerified ? " · verified by text" : " · not verified"}`],
              ["Created", formatDate(report.createdAt)],
              ["Property data", property.source === "rentcast" ? `Public records${property.edited.length ? `, homeowner edited ${property.edited.map((key) => FACT_LABELS[key] ?? key).join(", ").toLowerCase()}` : ", confirmed as is"}` : "Entered by homeowner"],
            ]}
          />
        </Section>
      ) : null}

      {showContact && report.financials ? <Financials financials={report.financials} /> : null}

      {estimate && active ? (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            <Section title="Selected project" n="01">
              <Rows
                rows={[
                  ["ADU type", estimate.projectLabel],
                  ["Size", `${formatNumber(estimate.sqft)} sqft · ${bedroomLabel(estimate.bedrooms)}`],
                  ["Finish", estimate.finishLabel],
                  ["Rental plan", active.label],
                  ["Long-term rent", `${formatMoney(estimate.monthlyRent)} / mo${estimate.rentSource === "manual" ? " (homeowner's figure)" : estimate.rentSource === "rentcast" ? " (RentCast comps)" : " (planning rate)"}`],
                ]}
              />
            </Section>
            <Section title="Property" n="02">
              {knownFacts.length > 0 ? (
                <Rows rows={knownFacts} />
              ) : (
                <p className="py-2 text-sm text-ink-soft">No public records were found for this address.</p>
              )}
            </Section>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Section title="Project cost" n="03">
              <Rows
                rows={[
                  ["Construction", formatMoney(estimate.construction)],
                  ["Architectural plans", formatMoney(estimate.design)],
                  ["City permits", formatMoney(estimate.cityFees)],
                  ["School & impact fees", formatMoney(estimate.schoolFees)],
                  ["Utility connections", formatMoney(estimate.utilityFees)],
                  ["Total project cost", formatMoney(estimate.total), true],
                ]}
              />
            </Section>
            <Section title="Value & equity" n="04">
              <Rows
                rows={[
                  ["Square-foot approach", formatMoney(estimate.sqftUplift)],
                  ["Income approach", estimate.incomeUplift == null ? "—" : formatMoney(estimate.incomeUplift)],
                  ["Blended value added", formatMoney(estimate.blendedUplift)],
                  ["New estimated home value", estimate.newHomeValue == null ? "—" : formatMoney(estimate.newHomeValue)],
                  ["Equity vs. cost", formatMoney(estimate.equity), true],
                ]}
              />
            </Section>
          </div>

          <Section title="Rental income" n="05">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-soft">
                    <th className="py-2 font-medium" />
                    {[estimate.scenarios.longTerm, estimate.scenarios.shortTerm].map((scenario) => (
                      <th key={scenario.id} className="py-2 text-right font-medium">
                        {scenario.label}
                        {scenario.id === estimate.rentalUse ? " ✓" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {(
                    [
                      ["Gross / month", (s) => formatMoney(s.monthlyGross)],
                      ["Net / year", (s) => formatMoney(s.annualNet)],
                      ["Net / month", (s) => formatMoney(s.monthlyNet)],
                      ["Cash-on-cash", (s) => formatPercent(cashOnCash(s.annualNet, estimate.total))],
                      ["Payback with rent growth", (s) => formatYears(s.breakEvenYears)],
                    ] as Array<[string, (s: RentalScenario) => string]>
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
            <div className="mt-6">
              <CashFlowChart series={active.series} breakEvenYears={active.breakEvenYears} />
            </div>
          </Section>

          <Section title="How these numbers are calculated" n="06">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-ink-soft">
              {estimate.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
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
