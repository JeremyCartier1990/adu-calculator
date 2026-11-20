import type { BreakdownStep } from "@/lib/breakdown";

/**
 * "How we got these numbers": each headline figure worked out with this report's
 * own inputs. Server-safe; the live builder re-renders it as settings change.
 */
export function CalculationBreakdown({ steps, settings, notes }: { steps: BreakdownStep[]; settings: string[]; notes: string[] }) {
  return (
    <div>
      <h3 className="font-display text-2xl text-ink sm:text-3xl">How we got these numbers</h3>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Settings used">
        {settings.map((setting) => (
          <li key={setting} className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-ink-soft">
            {setting}
          </li>
        ))}
      </ul>

      <ol className="mt-5 space-y-3">
        {steps.map((step) => (
          <li key={step.n} className="break-inside-avoid rounded-xl border border-line bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <h4 className="flex items-center gap-2.5 text-base font-semibold text-ink">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{step.n}</span>
                {step.title}
              </h4>
              <p className="pl-8 font-display text-xl tabular-nums text-ink sm:pl-0">{step.result}</p>
            </div>
            <dl className="mt-3 text-sm">
              {step.lines.map((line, index) => (
                <div
                  key={`${index}-${line.label}`}
                  className={`flex items-baseline justify-between gap-4 py-1.5 ${line.strong ? "border-t border-line pt-2 font-semibold text-ink" : ""}`}
                >
                  <dt className={line.strong ? "" : "text-ink"}>
                    {line.label}
                    {line.math ? <span className="block text-xs font-normal leading-5 text-ink-soft">{line.math}</span> : null}
                  </dt>
                  <dd className="shrink-0 tabular-nums">{line.value}</dd>
                </div>
              ))}
            </dl>
            {step.note ? <p className="mt-2 text-xs leading-5 text-ink-soft">{step.note}</p> : null}
          </li>
        ))}
      </ol>

      <details className="mt-3 rounded-xl border border-line bg-white p-4 sm:p-5">
        <summary className="cursor-pointer text-sm font-semibold text-pine">Every assumption we used</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink-soft">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
