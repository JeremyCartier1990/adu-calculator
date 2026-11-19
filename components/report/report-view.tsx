import { CashFlowChart } from "@/components/cash-flow-chart";
import { Kpi } from "@/components/report/kpi";
import { bedroomLabel } from "@/lib/assumptions";
import { BRAND } from "@/lib/brand";
import { calculateEstimate, type RentalScenario } from "@/lib/calculate";
import { formatMoney, formatNumber, formatYears } from "@/lib/money";
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      <div className="mt-3">{children}</div>
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

  return (
    <article className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-pine">ADU ROI report</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">{property.address}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Updated {formatDate(report.updatedAt)} · Report {report.id.slice(0, 8)}
          </p>
        </div>
        <a
          href={`/r/${report.id}/pdf`}
          className="no-print inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-ink px-6 text-sm font-semibold text-white hover:bg-ink/85"
        >
          Download PDF
        </a>
      </header>

      {showContact ? (
        <Section title="Lead">
          <Rows
            rows={[
              ["Name", report.name],
              ["Email", report.email],
              ["Phone", `${report.phone}${report.phoneVerified ? " · verified by text" : " · not verified"}`],
              ["Created", formatDate(report.createdAt)],
              ["Property data", property.source === "rentcast" ? `Public records${property.edited.length ? `, homeowner edited ${property.edited.map((key) => FACT_LABELS[key] ?? key).join(", ").toLowerCase()}` : ", confirmed as is"}` : "Entered by homeowner"],
            ]}
          />
        </Section>
      ) : null}

      {estimate && active ? (
        <>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-5">
            <Kpi label="Project cost" value={formatMoney(estimate.total)} />
            <Kpi label="Net income / mo" value={formatMoney(active.monthlyNet)} note={active.label} />
            <Kpi label="Cash-on-cash" value={formatPercent(cashOnCash(active.annualNet, estimate.total))} note="Year-one net ÷ cost" />
            <Kpi label="Payback" value={formatYears(active.breakEvenYears)} />
            <Kpi label="Equity created" value={formatMoney(estimate.equity)} tone={estimate.equity >= 0 ? "good" : "warn"} />
          </dl>

          <div className="grid gap-5 md:grid-cols-2">
            <Section title="Selected project">
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
            <Section title="Property">
              <Rows rows={(Object.keys(FACT_LABELS) as Array<keyof typeof property>).map((key) => [FACT_LABELS[key], fact(key)])} />
            </Section>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Section title="Project cost">
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
            <Section title="Value & equity">
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

          <Section title="Rental income">
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

          <Section title="How these numbers are calculated">
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
          <Rows rows={(Object.keys(FACT_LABELS) as Array<keyof typeof property>).map((key) => [FACT_LABELS[key], fact(key)])} />
        </Section>
      )}

      <p className="text-xs leading-5 text-ink-soft">
        Estimates, not a bid. Costs, rent, taxes, and value will vary; confirm them with a licensed contractor, a designer, and a tax
        advisor. Prepared by {BRAND.name} ({BRAND.domain}) with {BRAND.builder}.
      </p>
    </article>
  );
}
