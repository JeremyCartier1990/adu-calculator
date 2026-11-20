"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowBox, Eyebrow } from "@/components/eyebrow";
import { useAnalysis } from "@/components/funnel/use-analysis";
import { EmailPdf } from "@/components/report/email-pdf";
import { Kpi, KpiBand } from "@/components/report/kpi";
import { PropertyMap } from "@/components/report/property-map";
import { ResultsPanel } from "@/components/results-panel";
import { ASSUMPTIONS, bedroomLabel, FINISH_LEVELS, PROJECT_TYPES } from "@/lib/assumptions";
import { BRAND } from "@/lib/brand";
import { formatMoney, formatYears } from "@/lib/money";
import { cashOnCash, formatPercent, type ConfirmedProperty, type ReportInputs } from "@/lib/report";

type SaveState = "idle" | "saving" | "saved" | "error";

export function AnalysisSection({
  property,
  report,
  saveNote,
  saved = null,
  onReportPage = false,
}: {
  property: ConfirmedProperty;
  report: { id: string; editKey: string } | null;
  saveNote: string | null;
  /** Choices saved earlier, when the owner reopens the report. */
  saved?: ReportInputs | null;
  /** True on /r/[id], where "Open report" would point at the same page. */
  onReportPage?: boolean;
}) {
  const analysis = useAnalysis(property, saved);
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

  const status = report
    ? saveState === "saving"
      ? "Saving your choices…"
      : saveState === "error"
        ? "Couldn't save the last change. It will retry when you change something."
        : "Saved. Change any setting below; your report link always shows the latest."
    : (saveNote ?? "This analysis isn't saved.");

  return (
    <section id="analysis" className="mx-auto max-w-[1400px] scroll-mt-4 px-3 py-10 sm:px-4 md:py-14" aria-labelledby="analysis-heading">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-col lg:flex-row">
          <div className="flex flex-1 flex-col justify-between gap-8 p-6 sm:p-10">
            <div>
              <Eyebrow>Your ADU ROI report</Eyebrow>
              <h2 id="analysis-heading" className="mt-5 font-display text-3xl leading-[1.05] text-ink sm:text-5xl">
                {property.address}
              </h2>
              <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft" aria-live="polite">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${saveState === "error" ? "bg-clay" : saveState === "saving" ? "bg-ink-soft/50" : report ? "bg-good" : "bg-ink-soft/40"}`}
                  aria-hidden="true"
                />
                {status}
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
                  className="inline-flex min-h-12 items-center gap-3 rounded-lg bg-ink py-2 pl-5 pr-2 text-sm font-semibold text-white hover:bg-ink/85"
                >
                  Download PDF
                  <ArrowBox />
                </a>
                <EmailPdf reportId={report.id} editKey={report.editKey} beforeSend={() => save(inputsJson)} />
                <button
                  type="button"
                  onClick={async () => {
                    await save(inputsJson);
                    await navigator.clipboard.writeText(reportUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="inline-flex min-h-12 items-center rounded-lg border border-line bg-white px-5 text-sm font-semibold hover:border-ink"
                >
                  {copied ? "Link copied" : "Copy report link"}
                </button>
                {onReportPage ? null : (
                  <a
                    href={`/r/${report.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-12 items-center rounded-lg border border-line bg-white px-5 text-sm font-semibold hover:border-ink"
                  >
                    Open report
                  </a>
                )}
              </div>
            ) : null}
          </div>
          <PropertyMap
            address={property.address}
            latitude={property.latitude}
            longitude={property.longitude}
            className="m-3 mt-0 aspect-[16/10] rounded-xl lg:m-3 lg:aspect-auto lg:min-h-80 lg:w-[44%]"
          />
        </div>

        <div className="bg-ink p-3 sm:p-4">
          <KpiBand>
            <Kpi label="Project cost" value={formatMoney(estimate.total)} wide />
            <Kpi label="Net income / mo" value={formatMoney(active.monthlyNet)} note={active.id === "short_term" ? "Short-term rental" : "Long-term lease"} />
            <Kpi label="Cash-on-cash" value={formatPercent(roi)} note="Year-one net ÷ cost" />
            <Kpi label="Payback" value={formatYears(active.breakEvenYears)} note="With rent growth" />
            <Kpi label="Equity created" value={formatMoney(estimate.equity)} tone={estimate.equity >= 0 ? "good" : "warn"} note="Value added − cost" />
          </KpiBand>
        </div>

        <div className="grid items-start gap-8 p-4 sm:p-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-10 lg:p-10">
          <div className="rounded-xl border border-line bg-paper p-5 sm:p-6 lg:sticky lg:top-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line pb-4">
              <h3 className="whitespace-nowrap font-display text-2xl text-ink">ADU settings</h3>
              <span className="text-xs text-ink-soft">{report ? "Changes save automatically" : "Try any option"}</span>
            </div>

            <fieldset className="mt-5">
              <StepLegend n="01">ADU type</StepLegend>
              <div className="mt-3 grid gap-2">
                {PROJECT_TYPES.map((project) => {
                  const selected = analysis.projectType === project.id;
                  return (
                    <label
                      key={project.id}
                      className={`flex cursor-pointer gap-3 rounded-lg border bg-white px-4 py-3 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink/10 ${
                        selected ? "border-ink shadow-[0_0_0_1px_var(--ink)]" : "border-line hover:border-ink/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="projectType"
                        value={project.id}
                        checked={selected}
                        onChange={() => analysis.setProjectType(project.id)}
                        className="sr-only"
                      />
                      <span
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-ink bg-ink text-white" : "border-line"}`}
                        aria-hidden="true"
                      >
                        {selected ? (
                          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m3.5 8.5 3 3 6-7" />
                          </svg>
                        ) : null}
                      </span>
                      <span>
                        <span className="block font-medium text-ink">{project.title}</span>
                        <span className="mt-0.5 block text-sm leading-6 text-ink-soft">{project.text}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-6">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="adu-size">
                  <StepLegend n="02" as="span">
                    Size
                  </StepLegend>
                </label>
                <span className="font-display text-2xl tabular-nums text-ink">{analysis.sqft.toLocaleString("en-US")} sqft</span>
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
              <div className="flex justify-between text-xs text-ink-soft">
                <span>{ASSUMPTIONS.size.min.toLocaleString("en-US")} sqft</span>
                <span className="font-medium text-ink">{bedroomLabel(analysis.beds)}</span>
                <span>{ASSUMPTIONS.size.max.toLocaleString("en-US")} sqft</span>
              </div>
            </div>

            <fieldset className="mt-6">
              <StepLegend n="03">Finish</StepLegend>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-line bg-white p-1">
                {FINISH_LEVELS.map((level) => (
                  <label
                    key={level.id}
                    title={level.text}
                    className={`cursor-pointer rounded-md px-3 py-2.5 text-center text-sm font-medium transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink/10 ${
                      analysis.finish === level.id ? "bg-ink text-white" : "text-ink-soft hover:bg-paper hover:text-ink"
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

            <div className="mt-6">
              <label htmlFor="adu-rent">
                <StepLegend n="04" as="span">
                  Monthly rent (long-term)
                </StepLegend>
              </label>
              <div className="mt-3 flex min-h-12 items-center rounded-lg border border-line bg-white focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/10">
                <span className="pl-3 text-ink-soft">$</span>
                <input
                  id="adu-rent"
                  inputMode="decimal"
                  value={analysis.rentOverride ?? String(estimate.monthlyRent)}
                  onChange={(event) => analysis.setRentOverride(event.target.value)}
                  className="min-h-12 w-full bg-transparent px-2 text-base tabular-nums outline-none"
                />
              </div>
              <p className="mt-1.5 text-sm leading-6 text-ink-soft">
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

/** Numbered label for each ADU setting, like the steps on a drawing set. */
function StepLegend({ n, as = "legend", children }: { n: string; as?: "legend" | "span"; children: React.ReactNode }) {
  const Tag = as;
  return (
    <Tag className="flex items-center gap-2 text-sm font-semibold text-ink">
      <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink-soft">{n}</span>
      {children}
    </Tag>
  );
}

function noop() {}
