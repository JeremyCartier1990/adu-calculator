"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowBox, Eyebrow } from "@/components/eyebrow";
import { FinancingSection } from "@/components/funnel/financing-section";
import { FACT_FIELDS } from "@/components/funnel/shared";
import { useAnalysis } from "@/components/funnel/use-analysis";
import { CalculationBreakdown } from "@/components/report/calculation-breakdown";
import { InvestmentSummary, projectPhrase } from "@/components/report/investment-summary";
import { LotMap, requestLotDrawing } from "@/components/report/lot-map";
import { ResultsPanel } from "@/components/results-panel";
import { ASSUMPTIONS, bedroomLabel, FINISH_LEVELS, PROJECT_TYPES, projectTitle } from "@/lib/assumptions";
import { BRAND } from "@/lib/brand";
import { BEST_SETUP_YEARS } from "@/lib/optimize";
import { breakdownSteps, financingFor, headline, settingsUsed } from "@/lib/breakdown";
import { formatMoney } from "@/lib/money";
import type { ConfirmedProperty, ReportInputs } from "@/lib/report";

type SaveState = "idle" | "saving" | "saved" | "error";

export function AnalysisSection({
  property,
  report,
  saveNote,
  saved = null,
  onReportPage = false,
  team = false,
}: {
  property: ConfirmedProperty;
  report: { id: string; editKey: string } | null;
  saveNote: string | null;
  /** Choices saved earlier, when the owner reopens the report. */
  saved?: ReportInputs | null;
  /** True on /r/[id], where "Open report" would point at the same page. */
  onReportPage?: boolean;
  /** The team builder, which prefills the financing with the mortgage on record. */
  team?: boolean;
}) {
  const analysis = useAnalysis(property, saved, team && report ? report.id : null);
  const { estimate, inputs, facts } = analysis;
  const financing = financingFor(analysis.financing.inputs, estimate);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [copied, setCopied] = useState(false);
  // Phones show the report on its own; "Edit the numbers" swaps it for every setting.
  const [editing, setEditing] = useState(false);
  const reportOnly = editing ? "max-lg:hidden" : "";
  const settingsOnly = editing ? "" : "max-lg:hidden";
  const summary = headline(estimate, financing);

  function toggleEditing(next: boolean) {
    setEditing(next);
    requestAnimationFrame(() => document.getElementById("analysis")?.scrollIntoView({ block: "start" }));
  }
  const savedJson = useRef<string | null>(null);
  const inputsJson = JSON.stringify({ inputs, property: facts });

  async function save(json: string): Promise<boolean> {
    if (!report || json === savedJson.current) return true;
    setSaveState("saving");
    try {
      const response = await fetch(`/api/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-edit-key": report.editKey },
        body: json,
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

  const status = report
    ? saveState === "saving"
      ? "Saving your choices…"
      : saveState === "error"
        ? "Couldn't save the last change. It will retry when you change something."
        : "Saved. Your report link always shows the latest."
    : (saveNote ?? "This analysis isn't saved.");

  return (
    <section id="analysis" className={`mx-auto max-w-[1400px] scroll-mt-4 px-3 py-10 sm:px-4 md:py-14 ${editing ? "" : "max-lg:pb-28"}`} aria-labelledby="analysis-heading">
      {editing ? (
        <div className="sticky top-0 z-30 -mx-3 mb-3 border-b border-white/10 bg-ink px-4 py-3 text-white shadow-lg sm:-mx-4 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Editing · updates live</p>
              <p className="mt-0.5 truncate text-sm tabular-nums">
                {formatMoney(summary.invest)} → <span className="text-[#7fd6a8]">+{formatMoney(summary.valueAdded)}</span>
              </p>
              <p className="text-xs tabular-nums text-white/70">
                You keep {formatMoney(summary.longTerm)} lease · {formatMoney(summary.shortTerm)} short-term
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleEditing(false)}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-white px-4 text-sm font-semibold text-ink"
            >
              See report
            </button>
          </div>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className={`flex flex-col lg:flex-row ${reportOnly}`}>
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
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => toggleEditing(true)}
                  className="col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-ink bg-white px-5 text-sm font-semibold text-ink lg:hidden"
                >
                  <PencilIcon />
                  Edit the numbers
                </button>
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
                  className="col-span-2 inline-flex min-h-12 items-center justify-between gap-3 rounded-lg bg-ink py-2 pl-5 pr-2 text-sm font-semibold text-white hover:bg-ink/85 sm:justify-start"
                >
                  Download PDF
                  <ArrowBox />
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    await save(inputsJson);
                    await navigator.clipboard.writeText(reportUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className={`inline-flex min-h-12 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold hover:border-ink sm:px-5 ${onReportPage ? "col-span-2" : ""}`}
                >
                  {copied ? "Link copied" : "Copy report link"}
                </button>
                {onReportPage ? null : (
                  <a
                    href={`/r/${report.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-12 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold hover:border-ink sm:px-5"
                  >
                    Open report
                  </a>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className={`bg-ink p-5 sm:p-8 lg:p-10 ${reportOnly}`}>
          <InvestmentSummary estimate={estimate} summary={summary} />
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-white/15 px-4 py-3 text-sm text-white/80 sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-6">
              {analysis.onBest
                ? `This is the best setup for this property: a ${projectPhrase(estimate)}, the biggest the state allows here, with the highest ${BEST_SETUP_YEARS}-year return. You can change anything.`
                : `The best setup for this property is a ${analysis.best.sqft.toLocaleString("en-US")} sqft ${projectTitle(analysis.best.projectType).toLowerCase().replace("adu", "ADU")} with a standard finish.`}
            </p>
            {analysis.onBest ? null : (
              <button
                type="button"
                onClick={analysis.applyBest}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-ink hover:bg-white/90"
              >
                Use the best setup
              </button>
            )}
          </div>
        </div>

        <div className="grid items-start gap-8 p-4 sm:p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-10 lg:p-10">
          <div className={`min-w-0 space-y-8 ${reportOnly}`}>
            <CalculationBreakdown
              steps={breakdownSteps(estimate, financing)}
              settings={settingsUsed(estimate, financing, { homeValue: analysis.facts.homeValue, squareFootage: analysis.facts.squareFootage, lotSize: analysis.facts.lotSize })}
              notes={estimate.notes}
            />
            <ResultsPanel
              estimate={estimate}
              usingAirroi={analysis.usingAirroi}
              latitude={property.latitude}
              longitude={property.longitude}
              onMarketNumbers={analysis.onMarketNumbers}
              onVerifiedPhone={noop}
            />
          </div>

          <div className={`rounded-xl border border-line bg-paper p-5 sm:p-6 ${settingsOnly}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line pb-4">
              <h3 className="whitespace-nowrap font-display text-2xl text-ink">Change the numbers</h3>
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
              {analysis.projectType !== "garage_conversion" ? (
                <button
                  type="button"
                  onClick={() => {
                    // The map belongs to the report view on phones, so leave edit mode first.
                    setEditing(false);
                    requestAnimationFrame(requestLotDrawing);
                  }}
                  className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 13 4 9.5 10.5 3 13 5.5 6.5 12z M9 4.5l2.5 2.5" />
                  </svg>
                  {analysis.footprint ? "Redraw the ADU on the map" : "Draw the ADU on the map"}
                </button>
              ) : null}
              {analysis.projectType === "garage_conversion" ? (
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  Public records don&apos;t list garage size. Set this to the garage&apos;s floor area: about 400 sqft for two cars, 200 for one.
                </p>
              ) : null}
            </div>

            <fieldset className="mt-6">
              <StepLegend n="03">Finish</StepLegend>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-line bg-white p-1">
                {FINISH_LEVELS.map((level) => (
                  <label
                    key={level.id}
                    title={level.text}
                    className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md px-1 text-center text-sm font-medium transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink/10 ${
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
                        ? `RentCast comps for an ${ASSUMPTIONS.rent.reference.sqft} sqft, ${ASSUMPTIONS.rent.reference.bedrooms}-bedroom unit here, scaled to ${analysis.snapped.toLocaleString("en-US")} sqft.`
                        : "Los Angeles planning rate. Type over it if you know the rent.")}
              </p>
              {analysis.rentOverride !== null ? (
                <button type="button" onClick={() => analysis.setRentOverride(null)} className="mt-1 text-sm font-medium text-pine hover:underline">
                  Use the estimated rent
                </button>
              ) : null}
            </div>

            <fieldset className="mt-6">
              <StepLegend n="05">Short-term rental</StepLegend>
              <div className="mt-3 grid gap-4">
                <div>
                  <label htmlFor="nightly-rate" className="text-sm font-medium text-ink">
                    Nightly rate
                  </label>
                  <div className="mt-1.5 flex min-h-12 items-center rounded-lg border border-line bg-white focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/10">
                    <span className="pl-3 text-ink-soft">$</span>
                    <input
                      id="nightly-rate"
                      inputMode="decimal"
                      value={analysis.nightlyOverride ?? String(estimate.scenarios.shortTerm.nightlyRate ?? "")}
                      onChange={(event) => analysis.setNightlyOverride(event.target.value)}
                      className="min-h-12 w-full bg-transparent px-2 text-base tabular-nums outline-none"
                    />
                    <span className="whitespace-nowrap pr-3 text-sm text-ink-soft">/ night</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-ink-soft">
                    {analysis.nightlyOverride !== null
                      ? "Using the nightly rate you typed."
                      : analysis.usingAirroi
                        ? "AirROI average for similar rentals nearby."
                        : `Estimate: ${ASSUMPTIONS.shortTerm.nightlyFromMonthlyMultiplier}× the long-term rent, spread over ${ASSUMPTIONS.shortTerm.daysPerMonth} nights.`}
                  </p>
                  {analysis.nightlyOverride !== null ? (
                    <button type="button" onClick={() => analysis.setNightlyOverride(null)} className="mt-1 text-sm font-medium text-pine hover:underline">
                      Use the estimated nightly rate
                    </button>
                  ) : null}
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor="occupancy" className="text-sm font-medium text-ink">
                      Occupancy
                    </label>
                    <span className="font-display text-2xl tabular-nums text-ink">{analysis.occupancyPercent}%</span>
                  </div>
                  <input
                    id="occupancy"
                    type="range"
                    min={Math.round(ASSUMPTIONS.shortTerm.occupancyMin * 100)}
                    max={Math.round(ASSUMPTIONS.shortTerm.occupancyMax * 100)}
                    step={1}
                    value={analysis.occupancyPercent}
                    aria-valuetext={`${analysis.occupancyPercent} percent of nights booked`}
                    onChange={(event) => analysis.setOccupancyPercent(Number(event.target.value))}
                  />
                  <div className="flex justify-between text-xs text-ink-soft">
                    <span>{Math.round(ASSUMPTIONS.shortTerm.occupancyMin * 100)}%</span>
                    <span>{Math.round((analysis.occupancyPercent / 100) * ASSUMPTIONS.shortTerm.daysPerMonth)} nights a month</span>
                    <span>{Math.round(ASSUMPTIONS.shortTerm.occupancyMax * 100)}%</span>
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="mt-6">
              <StepLegend n="06">Property</StepLegend>
              <p className="mt-1.5 text-sm leading-6 text-ink-soft">From public records. Correct anything that&apos;s off; value and sizes feed the estimate.</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {FACT_FIELDS.map((field) => (
                  <div key={field.key} className={field.key === "homeValue" ? "col-span-2" : undefined}>
                    <label htmlFor={`fact-${field.key}`} className="text-sm font-medium text-ink">
                      {field.label}
                    </label>
                    <div className="mt-1.5 flex min-h-12 items-center rounded-lg border border-line bg-white focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/10">
                      {field.prefix ? <span className="pl-3 text-ink-soft">{field.prefix}</span> : null}
                      <input
                        id={`fact-${field.key}`}
                        inputMode="decimal"
                        value={analysis.factDraft[field.key]}
                        onChange={(event) => analysis.setFact(field.key, event.target.value)}
                        placeholder="—"
                        className={`min-h-12 w-full min-w-0 bg-transparent text-base tabular-nums outline-none ${field.prefix ? "px-2" : "px-3"}`}
                      />
                      {field.suffix ? <span className="whitespace-nowrap pr-3 text-sm text-ink-soft">{field.suffix}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <div className={settingsOnly}>
          <FinancingSection state={analysis.financing} estimate={estimate} />
        </div>

        {editing ? (
          <div className="p-4 sm:p-8 lg:hidden">
            <button
              type="button"
              onClick={() => toggleEditing(false)}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-ink px-5 text-sm font-semibold text-white"
            >
              Done, see the report
            </button>
          </div>
        ) : null}

        <div className={`border-t border-line p-4 sm:p-8 lg:px-10 ${reportOnly}`}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="font-display text-2xl text-ink">Place the ADU on your lot</h3>
            <p className="text-sm text-ink-soft">Satellite view · drawn sizes are approximate</p>
          </div>
          <LotMap
            address={property.address}
            latitude={property.latitude}
            longitude={property.longitude}
            footprint={analysis.footprint}
            onFootprint={analysis.setFootprint}
            targetSqft={analysis.sqft}
            onUseSqft={analysis.setSqft}
            canPlace={analysis.projectType !== "garage_conversion"}
          />
        </div>

      </div>

      {editing ? null : (
        <button
          type="button"
          onClick={() => toggleEditing(true)}
          className="fixed inset-x-4 bottom-4 z-30 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/25 lg:hidden"
        >
          <PencilIcon />
          Edit the numbers
        </button>
      )}
    </section>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.5 2.5l3 3L5 14H2v-3z" />
    </svg>
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
