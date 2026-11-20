import { CashFlowChart } from "@/components/cash-flow-chart";
import { StrPanel } from "@/components/str-panel";
import type { Estimate, RentalScenario } from "@/lib/calculate";
import { formatMoney } from "@/lib/money";
import { cashOnCash, formatPercent } from "@/lib/report";

const ORDINANCE_NOTE =
  "Short-term rentals of ADUs may be restricted by local rules. Los Angeles's home-sharing ordinance limits registration, primary-residence use, and how many nights a host can rent. Confirm the rules for this address before counting on nightly income.";

export function ResultsPanel({
  estimate,
  usingAirroi,
  latitude,
  longitude,
  onMarketNumbers,
  onVerifiedPhone,
}: {
  estimate: Estimate;
  usingAirroi: boolean;
  latitude: number | null;
  longitude: number | null;
  onMarketNumbers: (numbers: { adr: number; occupancy: number } | null) => void;
  onVerifiedPhone: (phone: string | null) => void;
}) {
  const longTerm = estimate.scenarios.longTerm;
  const shortTerm = {
    ...estimate.scenarios.shortTerm,
    sourceNote: usingAirroi
      ? "AirROI market rate and occupancy. Costs are planning allowances."
      : estimate.scenarios.shortTerm.sourceNote,
  };
  const rentRange =
    estimate.rentLow != null && estimate.rentHigh != null
      ? `${formatMoney(estimate.rentLow)}–${formatMoney(estimate.rentHigh)}`
      : null;

  return (
    <div className="space-y-5">
      {estimate.warnings.length > 0 ? (
        <ul className="space-y-2">
          {estimate.warnings.map((warning) => (
            <li key={warning} className="rounded-lg bg-pine-soft px-3 py-2 text-sm leading-6 text-pine">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      <section aria-labelledby="income-heading">
        <h3 id="income-heading" className="font-display text-2xl text-ink sm:text-3xl">Rental outlook</h3>
        <p className="mt-1 text-sm leading-6 text-ink-soft">The same ADU two ways, before loan payments: leased by the year, or rented by the night.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ScenarioCard scenario={longTerm} total={estimate.total} extra={rentRange ? `Rent range ${rentRange}` : undefined} />
          <ScenarioCard scenario={shortTerm} total={estimate.total} />
        </div>
        <StrPanel
          latitude={latitude}
          longitude={longitude}
          onMarketNumbers={onMarketNumbers}
          onVerifiedPhone={onVerifiedPhone}
        />
        <p className="mt-4 text-sm leading-6 text-ink-soft">{ORDINANCE_NOTE}</p>
        <div className="mt-6 rounded-xl border border-line bg-white p-4 sm:p-5">
          <CashFlowChart scenarios={[longTerm, shortTerm]} />
        </div>
      </section>
    </div>
  );
}

function ScenarioCard({ scenario, total, extra }: { scenario: RentalScenario; total: number; extra?: string }) {
  const tone = scenario.id === "long_term" ? "border-pine/40 bg-pine-soft" : "border-clay/30 bg-clay/5";
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <p className="text-sm font-semibold leading-5">{scenario.label}</p>
      <p className="mt-2 text-xs uppercase tracking-wide text-ink-soft">{scenario.summary}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{formatMoney(scenario.monthlyGross)}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-ink/10 pt-3 text-sm">
        <div>
          <dt className="text-xs text-ink-soft">Net / mo</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(scenario.monthlyNet)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Cash-on-cash</dt>
          <dd className="font-semibold tabular-nums">{formatPercent(cashOnCash(scenario.annualNet, total))}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Payback</dt>
          <dd className="font-semibold tabular-nums">{scenario.breakEvenYears == null ? "15+ yrs" : `${scenario.breakEvenYears.toFixed(1)} yrs`}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-5 text-ink-soft">{scenario.sourceNote}</p>
      {extra ? <p className="mt-1 text-xs leading-5 text-ink-soft">{extra}</p> : null}
    </div>
  );
}
