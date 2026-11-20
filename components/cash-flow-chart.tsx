import { formatMoney, formatMoneyCompact, formatYears } from "@/lib/money";
import type { RentalScenario } from "@/lib/calculate";

const COLORS: Record<RentalScenario["id"], string> = { long_term: "#0d5c63", short_term: "#c2562b" };
const SHORT_LABEL: Record<RentalScenario["id"], string> = { long_term: "Long-term lease", short_term: "Short-term rental" };

/** Cumulative cash flow for both rentals on one chart, starting from the project cost. */
export function CashFlowChart({ scenarios }: { scenarios: RentalScenario[] }) {
  const width = 640;
  const height = 280;
  const pad = { top: 20, right: 12, bottom: 32, left: 64 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const values = scenarios.flatMap((scenario) => scenario.series.map((point) => point.cumulative));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (year: number) => pad.left + (year / 15) * innerW;
  const y = (value: number) => pad.top + ((max - value) / span) * innerH;
  const ticks = [...new Set([max, 0, min])].sort((a, b) => b - a);
  const description = scenarios
    .map((scenario) =>
      scenario.breakEvenYears == null
        ? `${SHORT_LABEL[scenario.id]} stays below zero for all 15 years.`
        : `${SHORT_LABEL[scenario.id]} breaks even at about ${formatYears(scenario.breakEvenYears)}.`,
    )
    .join(" ");
  const years = scenarios[0]?.series ?? [];

  return (
    <figure>
      <figcaption className="mb-3 text-sm text-ink-soft">Cumulative cash flow over 15 years, starting from the project cost.</figcaption>
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {scenarios.map((scenario) => (
          <li key={scenario.id} className="flex items-center gap-2">
            <span className="h-0.5 w-5 rounded" style={{ background: COLORS[scenario.id] }} aria-hidden="true" />
            {SHORT_LABEL[scenario.id]}
            <span className="text-ink-soft">· {formatYears(scenario.breakEvenYears)}</span>
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="cashflow-title cashflow-desc" className="h-auto w-full">
        <title id="cashflow-title">Cumulative cash flow over 15 years</title>
        <desc id="cashflow-desc">{description}</desc>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? "#443f38" : "#e0d5c6"}
              strokeDasharray={tick === 0 ? "0" : "3 4"}
            />
            <text x={pad.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" fill="#443f38" fontSize="12">
              {formatMoneyCompact(tick)}
            </text>
          </g>
        ))}
        {scenarios.map((scenario) => {
          const line = scenario.series
            .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.year).toFixed(1)},${y(point.cumulative).toFixed(1)}`)
            .join(" ");
          return (
            <g key={scenario.id}>
              <path d={line} fill="none" stroke={COLORS[scenario.id]} strokeWidth="2.5" strokeLinejoin="round" />
              {scenario.breakEvenYears != null ? (
                <circle cx={x(scenario.breakEvenYears)} cy={y(0)} r="5" fill="white" stroke={COLORS[scenario.id]} strokeWidth="2.5" />
              ) : null}
            </g>
          );
        })}
        {[0, 5, 10, 15].map((year) => (
          <text key={year} x={x(year)} y={height - 8} textAnchor="middle" fill="#443f38" fontSize="12">
            {year === 0 ? "Start" : `Yr ${year}`}
          </text>
        ))}
      </svg>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-pine">Show the yearly table</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <caption className="sr-only">Yearly net income and cumulative cash flow for each rental</caption>
            <thead>
              <tr className="border-b border-line text-ink-soft">
                <th scope="col" className="py-2 font-medium">Year</th>
                {scenarios.map((scenario) => (
                  <th key={scenario.id} scope="col" className="py-2 text-right font-medium">
                    {SHORT_LABEL[scenario.id]}, cumulative
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((point, index) => (
                <tr key={point.year} className="border-b border-line/80">
                  <th scope="row" className="py-1.5 font-medium">{point.year === 0 ? "Start" : point.year}</th>
                  {scenarios.map((scenario) => (
                    <td key={scenario.id} className="py-1.5 text-right tabular-nums">
                      {formatMoney(scenario.series[index]?.cumulative ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
