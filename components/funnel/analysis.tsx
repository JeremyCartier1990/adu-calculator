"use client";

import { useEffect, useRef, useState } from "react";
import { useAnalysis } from "@/components/funnel/use-analysis";
import { Kpi } from "@/components/report/kpi";
import { ResultsPanel } from "@/components/results-panel";
import { ASSUMPTIONS, bedroomLabel, FINISH_LEVELS, PROJECT_TYPES } from "@/lib/assumptions";
import { BRAND } from "@/lib/brand";
import { formatMoney, formatYears } from "@/lib/money";
import { cashOnCash, formatPercent, type ConfirmedProperty } from "@/lib/report";

type SaveState = "idle" | "saving" | "saved" | "error";

export function AnalysisSection({
  property,
  report,
  saveNote,
}: {
  property: ConfirmedProperty;
  report: { id: string; editKey: string } | null;
  saveNote: string | null;
}) {
  const analysis = useAnalysis(property);
  const { estimate, inputs } = analysis;
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [copied, setCopied] = useState(false);
  const savedJson = useRef<string | null>(null);
  const inputsJson = JSON.stringify(inputs);

  async function save(json: string): Promise<boolean> {
    if (!report || json === savedJson.current) return true;
    setSaveState("saving");
    try {
      const response = await fetch(`/api/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-edit-key": report.editKey },
        body: `{"inputs":${json}}`,
      });
      if (!response.ok) throw new Error(String(response.status));
      savedJson.current = json;
      setSaveState("saved");
      return true;
    } catch {
      setSaveState("error");
      return false;
    }
  }

  // Autosave the homeowner's choices so the team sees what they settled on.
  useEffect(() => {
    if (!report) return;
    const timer = setTimeout(() => void save(inputsJson), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save reads refs; the JSON string is the trigger
  }, [inputsJson, report]);

  // Only mounted after the homeowner finishes the funnel, so this never renders on the server.
  const origin = typeof window === "undefined" ? BRAND.url : window.location.origin;
  const reportUrl = report ? `${origin}/r/${report.id}` : null;
  const active = estimate.rentalUse === "short_term" ? estimate.scenarios.shortTerm : estimate.scenarios.longTerm;
  const roi = cashOnCash(active.annualNet, estimate.total);

  return (
    <section id="analysis" className="mx-auto max-w-[1400px] scroll-mt-4 px-3 py-10 sm:px-4 md:py-14" aria-labelledby="analysis-heading">
      <div className="rounded-[28px] border border-line bg-surface p-5 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-pine">Your ADU ROI report</p>
            <h2 id="analysis-heading" className="mt-3 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
              {property.address}
            </h2>
            <p className="mt-2 text-sm text-ink-soft" aria-live="polite">
              {report
                ? saveState === "saving"
                  ? "Saving your choices…"
                  : saveState === "error"
                    ? "Couldn't save the last change. It will retry when you change something."
                    : "Saved. Change anything below; your report link always shows the latest."
                : (saveNote ?? "This analysis isn't saved.")}
            </p>
          </div>
          {report && reportUrl ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={`/r/${report.id}/pdf`}
                onClick={async (event) => {
                  event.preventDefault();
                  await save(inputsJson);
                  // Save first, so the PDF reflects the latest choices; then follow the link.
                  const link = document.createElement("a");
                  link.href = `/r/${report.id}/pdf`;
                  link.click();
                }}
                className="inline-flex min-h-12 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-ink/85"
              >
                Download PDF
              </a>
              <button
                type="button"
                onClick={async () => {
                  await save(inputsJson);
                  await navigator.clipboard.writeText(reportUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="inline-flex min-h-12 items-center rounded-full border border-line px-5 text-sm font-semibold hover:border-ink"
              >
                {copied ? "Link copied" : "Copy report link"}
              </button>
              <a
                href={`/r/${report.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center rounded-full border border-line px-5 text-sm font-semibold hover:border-ink"
              >
                Open report
              </a>
            </div>
          ) : null}
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-5">
          <Kpi label="Project cost" value={formatMoney(estimate.total)} />
          <Kpi label="Net income / mo" value={formatMoney(active.monthlyNet)} note={active.id === "short_term" ? "Short-term" : "Long-term"} />
          <Kpi label="Cash-on-cash" value={formatPercent(roi)} note="Year-one net ÷ cost" />
          <Kpi label="Payback" value={formatYears(active.breakEvenYears)} />
          <Kpi label="Equity created" value={formatMoney(estimate.equity)} tone={estimate.equity >= 0 ? "good" : "warn"} />
        </dl>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="space-y-6 lg:sticky lg:top-6">
            <fieldset>
              <legend className="text-sm font-semibold">ADU type</legend>
              <div className="mt-3 grid gap-2">
                {PROJECT_TYPES.map((project) => (
                  <label
                    key={project.id}
                    className={`block cursor-pointer rounded-2xl border px-4 py-3 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink/10 ${
                      analysis.projectType === project.id ? "border-ink bg-paper" : "border-line hover:border-ink/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="projectType"
                      value={project.id}
                      checked={analysis.projectType === project.id}
                      onChange={() => analysis.setProjectType(project.id)}
                      className="sr-only"
                    />
                    <span className="block font-medium">{project.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-ink-soft">{project.text}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="adu-size" className="text-sm font-semibold">
                  Size
                </label>
                <span className="font-serif text-3xl tabular-nums">{analysis.sqft.toLocaleString("en-US")} sqft</span>
              </div>
              <input
                id="adu-size"
                type="range"
                min={ASSUMPTIONS.size.min}
                max={ASSUMPTIONS.size.max}
                step={ASSUMPTIONS.size.step}
                value={analysis.sqft}
                onChange={(event) => analysis.setSqft(Number(event.target.value))}
              />
              <p className="text-sm text-ink-soft">{bedroomLabel(analysis.beds)}</p>
            </div>

            <fieldset>
              <legend className="text-sm font-semibold">Finish</legend>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {FINISH_LEVELS.map((level) => (
                  <label
                    key={level.id}
                    title={level.text}
                    className={`cursor-pointer rounded-full border px-3 py-2.5 text-center text-sm font-medium transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink/10 ${
                      analysis.finish === level.id ? "border-ink bg-ink text-white" : "border-line hover:border-ink/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="finish"
                      value={level.id}
                      checked={analysis.finish === level.id}
                      onChange={() => analysis.setFinish(level.id)}
                      className="sr-only"
                    />
                    {level.title}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="adu-rent" className="text-sm font-semibold">
                Monthly rent (long-term)
              </label>
              <div className="mt-2 flex min-h-12 items-center rounded-xl border border-line bg-white focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/10">
                <span className="pl-3 text-ink-soft">$</span>
                <input
                  id="adu-rent"
                  inputMode="decimal"
                  value={analysis.rentOverride ?? String(estimate.monthlyRent)}
                  onChange={(event) => analysis.setRentOverride(event.target.value)}
                  className="min-h-12 w-full bg-transparent px-2 text-base tabular-nums outline-none"
                />
              </div>
              <p className="mt-1 text-sm leading-6 text-ink-soft">
                {analysis.rentNote ??
                  (analysis.rentSource === "manual"
                    ? "Using the rent you typed."
                    : analysis.rentPending
                      ? "Checking rent comps for this size…"
                      : analysis.rentSource === "rentcast"
                        ? `RentCast comps for a ${analysis.snapped.toLocaleString("en-US")} sqft unit.`
                        : "Los Angeles planning rate. Type over it if you know the rent.")}
              </p>
              {analysis.rentOverride !== null ? (
                <button type="button" onClick={() => analysis.setRentOverride(null)} className="mt-1 text-sm font-medium text-pine hover:underline">
                  Use the estimated rent
                </button>
              ) : null}
            </div>
          </div>

          <ResultsPanel
            estimate={estimate}
            onRentalUse={analysis.setRentalUse}
            occupancyPercent={analysis.occupancyPercent}
            onOccupancyPercent={analysis.setOccupancyPercent}
            nightlyRateInput={analysis.nightlyOverride ?? String(estimate.scenarios.shortTerm.nightlyRate ?? "")}
            onNightlyRateInput={analysis.setNightlyOverride}
            nightlyIsCustom={analysis.nightlyOverride !== null}
            onResetNightly={() => analysis.setNightlyOverride(null)}
            usingAirroi={analysis.usingAirroi}
            latitude={property.latitude}
            longitude={property.longitude}
            onMarketNumbers={analysis.onMarketNumbers}
            onVerifiedPhone={noop}
          />
        </div>
      </div>
    </section>
  );
}

function noop() {}
