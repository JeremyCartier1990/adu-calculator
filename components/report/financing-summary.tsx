import type { Estimate } from "@/lib/calculate";
import type { Financing } from "@/lib/financing";
import { FINANCING, refinanceAfterBuild } from "@/lib/financing";
import { formatMoney } from "@/lib/money";
import { formatPercent } from "@/lib/report";

function Line({ label, value, hint, strong = false }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${strong ? "mt-1 border-t border-line pt-3 font-semibold text-ink" : ""}`}>
      <dt className={strong ? "" : "text-ink-soft"}>
        {label}
        {hint ? <span className="block text-xs font-normal text-ink-soft">{hint}</span> : null}
      </dt>
      <dd className="shrink-0 tabular-nums">{value}</dd>
    </div>
  );
}

const pct = (rate: number) => `${(rate * 100).toFixed(2)}%`;

/**
 * The financing outcome: how the build is funded and what each rental leaves every
 * month after the loan payments. Server-safe, so the saved report and the live builder share it.
 */
export function FinancingSummary({ financing, estimate }: { financing: Financing; estimate: Estimate }) {
  const refinance = financing.plan === "refinance";
  const projectCost = estimate.total;
  const after = refinanceAfterBuild(financing, estimate.blendedUplift);
  const rentals = [
    { id: "long_term", label: "Long-term lease", net: estimate.scenarios.longTerm.monthlyNet },
    { id: "short_term", label: "Short-term rental", net: estimate.scenarios.shortTerm.monthlyNet },
  ];
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
          {refinance ? "Monthly cash flow after loan payments" : "Monthly cash flow, paid in cash"}
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {rentals.map((rental) => {
            const flow = rental.net - financing.monthlyDebt;
            return (
              <div key={rental.id} className={`rounded-xl p-4 text-white sm:p-5 ${flow >= 0 ? "bg-pine" : "bg-clay"}`}>
                <p className="text-sm font-medium text-white/80">{rental.label}</p>
                <p className="mt-1 font-display text-4xl tabular-nums">{formatMoney(flow)}</p>
                <p className="mt-1 text-sm text-white/80">
                  {flow >= 0 ? `${formatMoney(flow * 12)} a year` : `${formatMoney(Math.abs(flow))} a month short`}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          {refinance
            ? `Each rental's net income minus ${formatMoney(financing.monthlyDebt)} a month in added loan payments.`
            : "No loan payments, so the whole net rent is yours."}
          {financing.cashFromOwner > 0 ? ` ${formatMoney(financing.cashFromOwner)} comes from savings.` : refinance ? " Nothing comes from savings." : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
          <h4 className="text-sm font-semibold text-ink">Paying for the build</h4>
          <dl className="mt-1 text-sm">
            <Line label="Project cost" value={formatMoney(projectCost)} />
            {refinance ? (
              <>
                {financing.cashDown > 0 ? <Line label="Cash you put in" value={formatMoney(financing.cashDown)} /> : null}
                <Line label="Cash-out refinance" value={formatMoney(financing.cashOut)} hint={`Up to ${formatMoney(financing.cashOutAvailable)} at ${Math.round(FINANCING.maxLoanToValue * 100)}% of value`} />
                <Line label="Unsecured loan" value={formatMoney(financing.unsecuredAmount)} hint={`${pct(financing.unsecuredRate)}, ${financing.unsecuredYears} years, up to ${formatMoney(FINANCING.unsecuredMax)}`} />
              </>
            ) : null}
            <Line label="From savings in all" value={formatMoney(financing.cashFromOwner)} strong />
          </dl>
        </div>

        <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
          <h4 className="text-sm font-semibold text-ink">Loan payments each month</h4>
          <dl className="mt-1 text-sm">
            {refinance ? (
              <>
                <Line
                  label="Added mortgage payment"
                  value={formatMoney(financing.addedMortgagePayment)}
                  hint={`${formatMoney(financing.currentPayment)}${financing.currentPaymentEstimated ? " (est.)" : ""} → ${formatMoney(financing.newPayment)} at ${pct(financing.refiRate)}`}
                />
                <Line label="Unsecured loan payment" value={formatMoney(financing.unsecuredPayment)} />
              </>
            ) : null}
            <Line label="Added loan payments" value={formatMoney(financing.monthlyDebt)} strong />
          </dl>
        </div>
      </div>

      {after ? (
        <div className="rounded-xl border border-pine/30 bg-pine-soft p-4 sm:p-5">
          <h4 className="text-sm font-semibold text-pine">Once it&apos;s built: refinance the loan</h4>
          <p className="mt-1 text-sm leading-6 text-ink-soft">
            The lender appraises the home with the ADU at about {formatMoney(after.appraisedValue)}. That value lets one mortgage pay off{" "}
            {after.unsecuredLeft > 0 ? `${formatMoney(after.unsecuredPaidOff)} of the` : "the"} unsecured loan at {pct(financing.refiRate)} instead of{" "}
            {pct(financing.unsecuredRate)}.
            {after.monthlySavings > 0
              ? ` That's ${formatMoney(after.monthlySavings)} less a month.`
              : " Here the closing costs on the new mortgage outweigh the lower rate, so keeping the personal loan is cheaper."}
          </p>
          <dl className="mt-1 text-sm">
            <Line label="New mortgage" value={formatMoney(after.newLoan)} hint={`${pct(financing.refiRate)}, ${FINANCING.refiYears} years, closing costs rolled in`} />
            <Line label="Added loan payments" value={`${formatMoney(after.monthlyDebt)} / mo`} hint={`Was ${formatMoney(financing.monthlyDebt)} / mo`} />
            {rentals.map((rental) => (
              <Line key={rental.id} label={`You keep, ${rental.label.toLowerCase()}`} value={`${formatMoney(rental.net - after.monthlyDebt)} / mo`} strong={rental.id === "long_term"} />
            ))}
          </dl>
        </div>
      ) : null}

      {refinance && financing.homeValue > 0 ? (
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
          {[
            ["Equity today", formatMoney(financing.equity)],
            ["New loan", formatMoney(financing.newLoan)],
            ["Loan-to-value after", formatPercent(financing.loanToValueAfter)],
          ].map(([label, value]) => (
            <div key={label} className="bg-white p-3 sm:p-4">
              <dt className="text-xs text-ink-soft">{label}</dt>
              <dd className="mt-1 font-semibold tabular-nums text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {financing.warnings.length ? (
        <ul className="space-y-2 text-sm leading-6 text-ink-soft">
          {financing.warnings.map((warning) => (
            <li key={warning} className="rounded-lg border border-clay/30 bg-clay/5 px-3 py-2">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs leading-5 text-ink-soft">
        Estimates, not a loan offer. A lender sets the amount and rate from credit, income and an appraisal. Payments are principal and interest; the
        refinance assumes a {FINANCING.refiYears}-year fixed loan with {Math.round(FINANCING.closingCostRate * 100)}% closing costs rolled in.
      </p>
    </div>
  );
}
