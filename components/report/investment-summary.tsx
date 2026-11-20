import type { Estimate } from "@/lib/calculate";
import type { Headline } from "@/lib/breakdown";
import { formatMoney, formatNumber } from "@/lib/money";

/** "Detached ADU" → "detached ADU", for use mid-sentence. */
export function projectPhrase(estimate: Estimate): string {
  return `${formatNumber(estimate.sqft)} sqft ${estimate.projectLabel.replace(/^\w/, (letter) => letter.toLowerCase())}`;
}

function Arrow() {
  return (
    <div className="hidden items-center justify-center text-white/35 md:flex" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h16M14 6l6 6-6 6" />
      </svg>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.06] p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{label}</p>
      {children}
    </div>
  );
}

const flowTone = (value: number) => (value >= 0 ? "text-[#7fd6a8]" : "text-[#f0a37f]");

/**
 * The report's answer in one sentence and three numbers: what you put in, what the
 * home gains, and what each rental leaves every month after the loan payments.
 * Server-safe, so the live builder and the shared report show the same thing.
 */
export function InvestmentSummary({ estimate, summary }: { estimate: Estimate; summary: Headline }) {
  const after = summary.financed ? "after the loan payments" : "with no loan payments";
  return (
    <div className="text-white">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">The short answer</p>
      <p className="mt-3 max-w-4xl font-display text-xl leading-snug sm:text-[2rem] sm:leading-[1.25]">
        Invest <strong className="font-semibold text-white">{formatMoney(summary.invest)}</strong> in a {projectPhrase(estimate)} and your home could be worth{" "}
        <strong className="font-semibold text-[#7fd6a8]">{formatMoney(summary.valueAdded)} more</strong>. Rented out, it would leave you{" "}
        <strong className={`font-semibold ${flowTone(summary.longTerm)}`}>{formatMoney(summary.longTerm)}</strong> a month on a lease, or{" "}
        <strong className={`font-semibold ${flowTone(summary.shortTerm)}`}>{formatMoney(summary.shortTerm)}</strong> as a short-term rental, {after}.
        {summary.afterRefinance ? (
          <>
            {" "}
            Once it&apos;s built, refinancing the loan into the mortgage raises that to{" "}
            <strong className={`font-semibold ${flowTone(summary.afterRefinance.longTerm)}`}>{formatMoney(summary.afterRefinance.longTerm)}</strong> and{" "}
            <strong className={`font-semibold ${flowTone(summary.afterRefinance.shortTerm)}`}>{formatMoney(summary.afterRefinance.shortTerm)}</strong>.
          </>
        ) : null}
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1.15fr] md:gap-2">
        <Block label="You invest">
          <p className="mt-2 font-display text-3xl tabular-nums sm:text-4xl">{formatMoney(summary.invest)}</p>
          <p className="mt-2 text-sm leading-5 text-white/65">
            {estimate.bedroomLabel} · {estimate.finishLabel} finish
            <br />
            Funded by {summary.funding}
          </p>
        </Block>
        <Arrow />
        <Block label="Your home gains">
          <p className="mt-2 font-display text-3xl tabular-nums text-[#7fd6a8] sm:text-4xl">+{formatMoney(summary.valueAdded)}</p>
          <p className="mt-2 text-sm leading-5 text-white/65">
            {summary.homeValueBefore != null && summary.homeValueAfter != null ? (
              <>
                {formatMoney(summary.homeValueBefore)} → {formatMoney(summary.homeValueAfter)}
                <br />
              </>
            ) : null}
            {summary.equity >= 0 ? `${formatMoney(summary.equity)} more than it costs` : `${formatMoney(-summary.equity)} less than it costs`}
          </p>
        </Block>
        <Arrow />
        <Block label="You keep every month">
          <dl className="mt-2 space-y-2">
            {[
              ["Long-term lease", summary.longTerm],
              ["Short-term rental", summary.shortTerm],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-white/75">{label}</dt>
                <dd className={`font-display text-2xl tabular-nums sm:text-3xl ${flowTone(value as number)}`}>{formatMoney(value as number)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-sm leading-5 text-white/65">
            {summary.financed ? `Net rent minus ${formatMoney(summary.monthlyDebt)} a month in loan payments` : "Net rent, paid in cash"}
          </p>
          {summary.afterRefinance ? (
            <div className="mt-3 border-t border-white/15 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">After the refinance</p>
              <p className="mt-1 text-sm leading-5 text-white/80">
                <span className={`font-semibold tabular-nums ${flowTone(summary.afterRefinance.longTerm)}`}>{formatMoney(summary.afterRefinance.longTerm)}</span> lease ·{" "}
                <span className={`font-semibold tabular-nums ${flowTone(summary.afterRefinance.shortTerm)}`}>{formatMoney(summary.afterRefinance.shortTerm)}</span> short-term
              </p>
              <p className="mt-1 text-xs leading-5 text-white/55">
                The reappraised home pays off the unsecured loan at the mortgage rate: {formatMoney(summary.afterRefinance.savings)} less a month.
              </p>
            </div>
          ) : null}
        </Block>
      </div>
    </div>
  );
}
