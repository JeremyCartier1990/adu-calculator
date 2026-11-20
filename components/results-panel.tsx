import { CashFlowChart } from "@/components/cash-flow-chart";
import { StrPanel } from "@/components/str-panel";
import { ASSUMPTIONS } from "@/lib/assumptions";
import type { Estimate, RentalUse } from "@/lib/calculate";
import { formatMoney, formatNumber, formatYears } from "@/lib/money";

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

const ORDINANCE_NOTE =
  "Short-term rentals of ADUs may be restricted by local rules. Los Angeles's home-sharing ordinance limits registration, primary-residence use, and how many nights a host can rent. Confirm the rules for this address before counting on nightly income.";

export function ResultsPanel({
  estimate,
  onRentalUse,
  occupancyPercent,
  onOccupancyPercent,
  nightlyRateInput,
  onNightlyRateInput,
  nightlyIsCustom,
  onResetNightly,
  usingAirroi,
  latitude,
  longitude,
  onMarketNumbers,
  onVerifiedPhone,
}: {
  estimate: Estimate;
  onRentalUse: (use: RentalUse) => void;
  occupancyPercent: number;
  onOccupancyPercent: (value: number) => void;
  nightlyRateInput: string;
  onNightlyRateInput: (value: string) => void;
  nightlyIsCustom: boolean;
  onResetNightly: () => void;
  usingAirroi: boolean;
  latitude: number | null;
  longitude: number | null;
  onMarketNumbers: (numbers: { adr: number; occupancy: number } | null) => void;
  onVerifiedPhone: (phone: string | null) => void;
}) {
  const meterMax = Math.max(estimate.blendedUplift, estimate.total, 1);
  const active = estimate.rentalUse === "short_term" ? estimate.scenarios.shortTerm : estimate.scenarios.longTerm;
  const rentRange =
    estimate.rentLow != null && estimate.rentHigh != null
      ? `${formatMoney(estimate.rentLow)}–${formatMoney(estimate.rentHigh)}`
      : null;
  const scenarioName = estimate.rentalUse === "short_term" ? "Short-term rental" : "Long-term lease";

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="estimate-heading">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Your estimate</p>
        <h3 id="estimate-heading" className="mt-2 font-display text-3xl text-ink">
          {estimate.projectLabel}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          {formatNumber(estimate.sqft)} sqft · {estimate.bedroomLabel} · {estimate.finishLabel} finish
        </p>
        <p className="mt-4 text-sm leading-6 text-ink-soft">
          These figures are estimates, not a quote. Costs, rent, taxes, and resale value will vary.
        </p>


        {estimate.warnings.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {estimate.warnings.map((warning) => (
              <li key={warning} className="rounded-lg bg-pine-soft px-3 py-2 text-sm leading-6 text-pine">
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="cost-heading">
        <h3 id="cost-heading" className="font-display text-2xl">Project cost</h3>
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

      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="income-heading">
        <h3 id="income-heading" className="font-display text-2xl">Rent & payback</h3>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          Both figures stay on screen. Payback, the chart, and the income approach follow the one you select.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Rental scenario">
          <ScenarioCard
            scenario={estimate.scenarios.longTerm}
            selected={estimate.rentalUse === "long_term"}
            onSelect={() => onRentalUse("long_term")}
            extra={rentRange ? `RentCast range ${rentRange}` : undefined}
          />
          <ScenarioCard
            scenario={{
              ...estimate.scenarios.shortTerm,
              sourceNote: usingAirroi
                ? "AirROI market rate and occupancy. The costs below are still planning allowances."
                : estimate.scenarios.shortTerm.sourceNote,
            }}
            selected={estimate.rentalUse === "short_term"}
            onSelect={() => onRentalUse("short_term")}
          />
        </div>
        <StrPanel
          latitude={latitude}
          longitude={longitude}
          bedrooms={estimate.bedrooms}
          onMarketNumbers={onMarketNumbers}
          onVerifiedPhone={onVerifiedPhone}
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nightly-rate" className="text-sm font-medium">
              Nightly rate
            </label>
            <div className="mt-1 flex min-h-12 items-center rounded-lg border border-line bg-white focus-within:border-pine focus-within:ring-2 focus-within:ring-pine">
              <span className="pl-3 text-ink-soft">$</span>
              <input
                id="nightly-rate"
                inputMode="decimal"
                value={nightlyRateInput}
                onChange={(event) => onNightlyRateInput(event.target.value)}
                className="min-h-12 w-full bg-transparent px-2 text-base outline-none"
              />
            </div>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              Default is {ASSUMPTIONS.shortTerm.nightlyFromMonthlyMultiplier}× the long-term rent, spread over{" "}
              {ASSUMPTIONS.shortTerm.daysPerMonth} days.
            </p>
            {nightlyIsCustom ? (
              <button
                type="button"
                className="mt-1 text-sm font-semibold text-pine underline-offset-2 hover:underline"
                onClick={onResetNightly}
              >
                Use the estimated nightly rate
              </button>
            ) : null}
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="occupancy" className="text-sm font-medium">
                Occupancy
              </label>
              <span className="font-semibold tabular-nums">{occupancyPercent}%</span>
            </div>
            <input
              id="occupancy"
              type="range"
              min={Math.round(ASSUMPTIONS.shortTerm.occupancyMin * 100)}
              max={Math.round(ASSUMPTIONS.shortTerm.occupancyMax * 100)}
              step={1}
              value={occupancyPercent}
              aria-valuemin={Math.round(ASSUMPTIONS.shortTerm.occupancyMin * 100)}
              aria-valuemax={Math.round(ASSUMPTIONS.shortTerm.occupancyMax * 100)}
              aria-valuenow={occupancyPercent}
              aria-valuetext={`${occupancyPercent} percent occupied`}
              onChange={(event) => onOccupancyPercent(Number(event.target.value))}
            />
            <p className="text-xs leading-5 text-ink-soft">
              Los Angeles planning default is {Math.round(ASSUMPTIONS.shortTerm.defaultOccupancy * 100)}%. Empty nights are already out of the gross.
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-ink-soft">{ORDINANCE_NOTE}</p>

        <h4 className="mt-6 font-display text-xl">{active.label}</h4>
        <p className="mt-1 text-sm text-ink-soft">{active.sourceNote}</p>
        <dl className="mt-2">
          <Row label={active.summary} value={formatMoney(active.monthlyGross)} />
          <Row label="Gross annual revenue" value={formatMoney(active.annualGross)} />
          {active.lines.map((line) => (
            <Row key={line.label} label={line.label} value={formatMoney(line.amount)} hint={line.hint} />
          ))}
          <Row label="Net income / year" value={formatMoney(active.annualNet)} strong />
          <Row label="Net income / month" value={formatMoney(active.monthlyNet)} hint="Year-one net divided by 12" />
          <Row label="Payback with rent growth" value={formatYears(active.breakEvenYears)} />
          <Row label="Simple payback, no growth" value={formatYears(active.simplePaybackYears)} />
        </dl>
        <div className="mt-6">
          <CashFlowChart series={active.series} breakEvenYears={active.breakEvenYears} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="value-heading">
        <h3 id="value-heading" className="font-display text-2xl">Value & equity</h3>
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
            hint={
              estimate.incomeUplift == null
                ? `Hidden because ${scenarioName.toLowerCase()} net income is not positive`
                : `Year-one ${scenarioName.toLowerCase()} net ÷ cap rate`
            }
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

      <details className="rounded-xl border border-line bg-surface p-5 sm:p-6">
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

function ScenarioCard({
  scenario,
  selected,
  onSelect,
  extra,
}: {
  scenario: Estimate["scenarios"]["longTerm"];
  selected: boolean;
  onSelect: () => void;
  extra?: string;
}) {
  return (
    <label
      className={`block cursor-pointer rounded-lg border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pine ${selected ? "border-pine bg-pine-soft" : "border-line bg-white"}`}
    >
      <input
        type="radio"
        name="rentalUse"
        value={scenario.id}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="block text-sm font-semibold leading-5">{scenario.label}</span>
      <span className="mt-2 block text-xs uppercase tracking-wide text-ink-soft">{scenario.summary}</span>
      <span className="mt-1 block font-display text-2xl tabular-nums">{formatMoney(scenario.monthlyGross)}</span>
      <span className="mt-2 block text-sm text-ink-soft">
        Net {formatMoney(scenario.monthlyNet)} / month · {formatYears(scenario.breakEvenYears)}
      </span>
      <span className="mt-2 block text-xs leading-5 text-ink-soft">{scenario.sourceNote}</span>
      {extra ? <span className="mt-1 block text-xs leading-5 text-ink-soft">{extra}</span> : null}
    </label>
  );
}
