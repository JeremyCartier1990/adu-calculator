import { formatMoney, formatMoneyCompact, formatYears } from "@/lib/money";
import type { CashPoint } from "@/lib/calculate";

type CashFlowChartProps = {
  series: CashPoint[];
  breakEvenYears: number | null;
};

export function CashFlowChart({ series, breakEvenYears }: CashFlowChartProps) {
  const width = 640;
  const height = 280;
  const pad = { top: 20, right: 12, bottom: 32, left: 64 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const values = series.map((point) => point.cumulative);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (year: number) => pad.left + (year / 15) * innerW;
  const y = (value: number) => pad.top + ((max - value) / span) * innerH;
  const line = series
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.year).toFixed(1)},${y(point.cumulative).toFixed(1)}`)
    .join(" ");
  const area = `M${x(0).toFixed(1)},${y(0).toFixed(1)} ${series
    .map((point) => `L${x(point.year).toFixed(1)},${y(point.cumulative).toFixed(1)}`)
    .join(" ")} L${x(15).toFixed(1)},${y(0).toFixed(1)} Z`;
  const ticks = [...new Set([max, 0, min])].sort((a, b) => b - a);
  const description =
    breakEvenYears == null
      ? "Cumulative cash flow stays below zero for all 15 years."
      : `Cumulative cash flow crosses zero at about ${formatYears(breakEvenYears)}.`;

  return (
    <figure>
      <figcaption className="mb-3 text-sm text-ink-soft">
        Cumulative cash flow over 15 years, starting from the project cost. {description}
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby="cashflow-title cashflow-desc"
        className="h-auto w-full"
      >
        <title id="cashflow-title">Cumulative cash flow over 15 years</title>
        <desc id="cashflow-desc">{description}</desc>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? "#9a3412" : "#e0d5c6"}
              strokeDasharray={tick === 0 ? "0" : "3 4"}
            />
            <text x={pad.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" fill="#443f38" fontSize="12">
              {formatMoneyCompact(tick)}
            </text>
          </g>
        ))}
        <path d={area} fill="#234237" opacity="0.12" />
        <path d={line} fill="none" stroke="#234237" strokeWidth="2.5" strokeLinejoin="round" />
        {breakEvenYears != null ? (
          <g>
            <line
              x1={x(breakEvenYears)}
              x2={x(breakEvenYears)}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke="#9a3412"
              strokeDasharray="4 4"
            />
            <text
              x={x(breakEvenYears) + (breakEvenYears > 11 ? -6 : 6)}
              y={pad.top + 12}
              textAnchor={breakEvenYears > 11 ? "end" : "start"}
              fill="#9a3412"
              fontSize="12"
            >
              Break-even
            </text>
          </g>
        ) : null}
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
            <caption className="sr-only">Yearly net income and cumulative cash flow</caption>
            <thead>
              <tr className="border-b border-line text-ink-soft">
                <th scope="col" className="py-2 font-medium">Year</th>
                <th scope="col" className="py-2 font-medium">Net income</th>
                <th scope="col" className="py-2 font-medium">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.year} className="border-b border-line/80">
                  <th scope="row" className="py-1.5 font-medium">{point.year === 0 ? "Start" : point.year}</th>
                  <td className="py-1.5 tabular-nums">{point.year === 0 ? "—" : formatMoney(point.net)}</td>
                  <td className="py-1.5 tabular-nums">{formatMoney(point.cumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
