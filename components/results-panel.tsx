import { CashFlowChart } from "@/components/cash-flow-chart";
import type { Estimate } from "@/lib/calculate";
import { formatMoney, formatNumber, formatYears } from "@/lib/money";

const RENT_SOURCE = {
  rentcast: "RentCast rent estimate",
  assumption: "Los Angeles planning rate",
  manual: "Rent you entered",
} as const;

function Row({
  label,
  value,
  hint,
  strong = false,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${strong ? "mt-1 border-t border-line pt-3" : ""}`}>
      <dt className={strong ? "font-semibold text-ink" : "text-ink-soft"}>
        {label}
        {hint ? <span className="mt-0.5 block text-xs font-normal text-ink-soft">{hint}</span> : null}
      </dt>
      <dd className={`shrink-0 tabular-nums ${strong ? "text-lg font-semibold text-ink" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

function Meter({ label, value, max, tone }: { label: string; value: number; max: number; tone: "pine" | "clay" }) {
  const width = Math.max(6, Math.round((Math.max(value, 0) / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink-soft">{label}</span>
        <span className="tabular-nums font-medium">{formatMoney(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-paper-deep">
        <div className={`h-2 rounded-full ${tone === "pine" ? "bg-pine" : "bg-clay"}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function ResultsPanel({ estimate }: { estimate: Estimate }) {
  const meterMax = Math.max(estimate.blendedUplift, estimate.total, 1);
  const rentRange =
    estimate.rentLow != null && estimate.rentHigh != null
      ? `${formatMoney(estimate.rentLow)}–${formatMoney(estimate.rentHigh)}`
      : null;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_50px_rgba(28,25,21,0.06)] sm:p-6" aria-labelledby="estimate-heading">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay">Estimate</p>
        <h3 id="estimate-heading" className="mt-2 font-serif text-3xl tracking-tight text-ink">
          {estimate.projectLabel}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          {formatNumber(estimate.sqft)} sqft · {estimate.bedroomLabel} · {estimate.finishLabel} finish
        </p>
        <p className="mt-4 text-sm leading-6 text-ink-soft">
          These figures are estimates, not a quote. Costs, rent, taxes, and resale value will vary.
        </p>

        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-paper px-3 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-soft">Project cost</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(estimate.total)}</dd>
          </div>
          <div className="rounded-2xl bg-paper px-3 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-soft">Net / month</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(estimate.monthlyNet)}</dd>
          </div>
          <div className="rounded-2xl bg-paper px-3 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-soft">Payback</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{formatYears(estimate.breakEvenYears)}</dd>
          </div>
        </dl>

        {estimate.warnings.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {estimate.warnings.map((warning) => (
              <li key={warning} className="rounded-2xl bg-pine-soft px-3 py-2 text-sm leading-6 text-pine">
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="cost-heading">
        <h3 id="cost-heading" className="font-serif text-2xl tracking-tight">Project cost</h3>
        <dl className="mt-2">
          <Row label="Construction" value={formatMoney(estimate.construction)} hint="Size × cost per square foot" />
          <Row label="Architectural plans" value={formatMoney(estimate.design)} />
          <Row
            label="Permits & fees"
            value={formatMoney(estimate.permitsAndFees)}
            hint="City permits, school fees, and utility connections"
          />
          <Row label="City permits" value={formatMoney(estimate.cityFees)} />
          <Row
            label="School & impact fees"
            value={formatMoney(estimate.schoolFees)}
            hint={estimate.schoolFees === 0 ? "Under 750 sqft, this allowance is $0" : "Applies at 750 sqft and up"}
          />
          <Row label="Utility connections" value={formatMoney(estimate.utilityFees)} />
          <Row label="Total project cost" value={formatMoney(estimate.total)} strong />
        </dl>
      </section>

      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="income-heading">
        <h3 id="income-heading" className="font-serif text-2xl tracking-tight">Rent & payback</h3>
        <p className="mt-1 text-sm text-ink-soft">{RENT_SOURCE[estimate.rentSource]}</p>
        <dl className="mt-2">
          <Row
            label="Gross monthly rent"
            value={formatMoney(estimate.monthlyRent)}
            hint={rentRange ? `Range ${rentRange}` : undefined}
          />
          <Row label="Gross annual rent" value={formatMoney(estimate.yearOne.gross)} />
          <Row label="Vacancy" value={formatMoney(estimate.yearOne.vacancy)} />
          <Row label="Maintenance" value={formatMoney(estimate.yearOne.maintenance)} />
          <Row label="Insurance" value={formatMoney(estimate.yearOne.insurance)} />
          <Row
            label="Added property tax"
            value={formatMoney(estimate.yearOne.propertyTax)}
            hint="1.2% of project cost"
          />
          <Row label="Net income / year" value={formatMoney(estimate.annualNet)} strong />
          <Row label="Net income / month" value={formatMoney(estimate.monthlyNet)} hint="Year-one net divided by 12" />
          <Row label="Payback with rent growth" value={formatYears(estimate.breakEvenYears)} />
          <Row label="Simple payback, no growth" value={formatYears(estimate.simplePaybackYears)} />
        </dl>
        <div className="mt-6">
          <CashFlowChart series={estimate.series} breakEvenYears={estimate.breakEvenYears} />
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="value-heading">
        <h3 id="value-heading" className="font-serif text-2xl tracking-tight">Value & equity</h3>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          {estimate.usedFallbackValuePerSqft
            ? "Using a fallback price per square foot until the home's size and value are both filled in."
            : `About ${formatMoney(estimate.valuePerSqft)} per square foot of the existing home.`}
        </p>
        <div className="mt-4 space-y-3">
          <Meter label="Estimated value added" value={estimate.blendedUplift} max={meterMax} tone="pine" />
          <Meter label="Project cost" value={estimate.total} max={meterMax} tone="clay" />
        </div>
        <dl className="mt-4">
          <Row label="Square-foot approach" value={formatMoney(estimate.sqftUplift)} />
          <Row
            label="Income approach"
            value={estimate.incomeUplift == null ? "—" : formatMoney(estimate.incomeUplift)}
            hint={estimate.incomeUplift == null ? "Hidden when net income is not positive" : "Year-one net ÷ cap rate"}
          />
          <Row label="Blended value added" value={formatMoney(estimate.blendedUplift)} />
          <Row
            label="New estimated home value"
            value={estimate.newHomeValue == null ? "—" : formatMoney(estimate.newHomeValue)}
            hint={estimate.newHomeValue == null ? "Add the current home value to see this" : "Current value plus blended uplift"}
          />
          <Row
            label="Equity vs. cost"
            value={formatMoney(estimate.equity)}
            hint={estimate.equity >= 0 ? "Value added minus project cost" : "Cost is higher than the value added"}
            strong
          />
        </dl>
        <p className={`mt-3 text-sm leading-6 ${estimate.equity >= 0 ? "text-good" : "text-clay"}`}>
          {estimate.equity >= 0
            ? "On these assumptions, the value added is higher than the project cost."
            : "On these assumptions, the project costs more than the value it adds. Rental payback can still be the reason to build."}
        </p>
      </section>

      <details className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <summary className="cursor-pointer font-medium text-pine">How these numbers are calculated</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink-soft">
          {estimate.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
