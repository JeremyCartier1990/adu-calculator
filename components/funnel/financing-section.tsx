"use client";

import { FinancingSummary } from "@/components/report/financing-summary";
import type { Estimate } from "@/lib/calculate";
import { calculateFinancing, FINANCING } from "@/lib/financing";
import { formatMoney } from "@/lib/money";
import type { FinancingField, FinancingState } from "./use-financing";

const PLANS = [
  { id: "refinance", title: "Refinance + loan" },
  { id: "cash", title: "Pay cash" },
] as const;

export function Field({
  id,
  label,
  unit,
  value,
  onChange,
  hint,
  placeholder,
}: {
  id: string;
  label: string;
  unit: "$" | "%" | "$/mo" | "years";
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5 flex min-h-12 items-center rounded-lg border border-line bg-white focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/10">
        {unit === "$" || unit === "$/mo" ? <span className="pl-3 text-ink-soft">$</span> : null}
        <input
          id={id}
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-12 w-full min-w-0 bg-transparent px-2 text-base tabular-nums outline-none placeholder:text-ink-soft/60"
        />
        {unit === "%" ? (
          <span className="pr-3 text-ink-soft">%</span>
        ) : unit === "$/mo" ? (
          <span className="whitespace-nowrap pr-3 text-sm text-ink-soft">/ mo</span>
        ) : unit === "years" ? (
          <span className="pr-3 text-sm text-ink-soft">years</span>
        ) : null}
      </div>
      {hint ? <p className="mt-1 text-xs leading-5 text-ink-soft">{hint}</p> : null}
    </div>
  );
}

/** "How will you pay for it?": the homeowner's numbers on the left, the monthly outcome on the right. */
export function FinancingSection({ state, estimate }: { state: FinancingState; estimate: Estimate }) {
  // Loan payments don't depend on the rental; the summary subtracts them from each one.
  const financing = calculateFinancing(state.inputs, estimate.total, estimate.scenarios.longTerm.monthlyNet);
  const field = (name: FinancingField) => ({ id: `financing-${name}`, value: state.draft[name], onChange: (value: string) => state.setField(name, value) });
  const refinance = state.plan === "refinance";

  return (
    <div className="border-t border-line p-4 sm:p-8 lg:p-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-display text-2xl text-ink sm:text-3xl">How will you pay for it?</h3>
        <p className="text-sm text-ink-soft">Uses the mortgage under Property</p>
      </div>

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-10">
        <div className="rounded-xl border border-line bg-paper p-4 sm:p-6">
          <div role="radiogroup" aria-label="Payment plan" className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-white p-1">
            {PLANS.map((plan) => (
              <label
                key={plan.id}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md px-3 text-center text-sm font-medium transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink/10 ${
                  state.plan === plan.id ? "bg-ink text-white" : "text-ink-soft hover:bg-paper hover:text-ink"
                }`}
              >
                <input type="radio" name="financing-plan" value={plan.id} checked={state.plan === plan.id} onChange={() => state.setPlan(plan.id)} className="sr-only" />
                {plan.title}
              </label>
            ))}
          </div>

          {refinance ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field
                {...field("cashDown")}
                label="Cash you put in"
                unit="$"
                placeholder="0"
                hint="Paid first; the refinance and loan cover the rest"
              />
              <Field {...field("homeValue")} label="Home value today" unit="$" placeholder="1,200,000" />
              <div>
                <Field {...field("refiRate")} label="30-year refinance rate" unit="%" placeholder={percentLabel(FINANCING.defaultRefiRate)} />
                {state.market ? (
                  <p className="mt-1 text-xs leading-5 text-ink-soft">
                    Freddie Mac average, week of {weekLabel(state.market.asOf)}: {percentLabel(state.market.rate)}%.{" "}
                    {state.inputs.refiRate !== state.market.rate ? (
                      <button type="button" onClick={state.useMarketRate} className="-my-2 inline-flex min-h-10 items-center px-1 font-semibold text-pine hover:underline">
                        Use it
                      </button>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <Field {...field("unsecuredRate")} label="Unsecured loan rate" unit="%" hint={`Personal loan, up to ${formatMoney(FINANCING.unsecuredMax)}`} />
              <Field
                {...field("unsecuredYears")}
                label="Unsecured loan term"
                unit="years"
                placeholder={String(FINANCING.unsecuredYears)}
                hint={`1 to ${FINANCING.unsecuredMaxYears} years`}
              />
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-ink-soft">
              Paying cash adds no loan payments, so the whole net rent is yours. Switch to Refinance + loan to see what borrowing against the home would
              cost each month.
            </p>
          )}
        </div>

        <FinancingSummary financing={financing} estimate={estimate} />
      </div>
    </div>
  );
}

/** 0.059 → "5.9", without floating-point noise. */
function percentLabel(rate: number): string {
  return String(Math.round(rate * 10000) / 100);
}

function weekLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
