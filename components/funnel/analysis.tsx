"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowBox, Eyebrow } from "@/components/eyebrow";
import { Field, FinancingSection } from "@/components/funnel/financing-section";
import { ScheduleCall } from "@/components/funnel/schedule-call";
import { FACT_FIELDS } from "@/components/funnel/shared";
import { useAnalysis } from "@/components/funnel/use-analysis";
import { CalculationBreakdown } from "@/components/report/calculation-breakdown";
import { InvestmentSummary, projectPhrase } from "@/components/report/investment-summary";
import { LotMapDialog } from "@/components/report/lot-map-dialog";
import { ResultsPanel } from "@/components/results-panel";
import { ASSUMPTIONS, bedroomLabel, finishTitle, FINISH_LEVELS, PROJECT_TYPES, projectTitle } from "@/lib/assumptions";
import { BRAND } from "@/lib/brand";
import { BEST_SETUP_YEARS } from "@/lib/optimize";
import { breakdownSteps, financingFor, headline, settingsUsed, type Headline } from "@/lib/breakdown";
import { areaSqft } from "@/lib/footprint";
import { formatMoney, formatNumber } from "@/lib/money";
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

  // The three headline numbers follow the page once the summary scrolls away, so every change shows.
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryGone, setSummaryGone] = useState(false);
  useEffect(() => {
    const band = summaryRef.current;
    if (!band) return;
    const observer = new IntersectionObserver(([entry]) => setSummaryGone(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(band);
    return () => observer.disconnect();
  }, []);

  // The lot map opens full screen: "open" to look and place, "draw" to start tapping corners.
  const [map, setMap] = useState<"open" | "draw" | null>(null);

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
    <section id="analysis" className={`mx-auto max-w-[1400px] scroll-mt-4 px-3 py-10 sm:px-4 md:py-14 ${editing ? "max-lg:pt-28" : "max-lg:pb-28"}`} aria-labelledby="analysis-heading">
      {editing || summaryGone ? (
        <LiveNumbers
          summary={summary}
          className={`${editing ? "" : "max-lg:hidden"} ${summaryGone ? "" : "lg:hidden"}`}
          onDone={editing ? () => toggleEditing(false) : null}
        />
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
                {team ? null : (
                  <a
                    href="#book-call"
                    className="col-span-2 inline-flex min-h-12 items-center justify-center rounded-lg border border-pine bg-pine/10 px-5 text-sm font-semibold text-ink hover:bg-pine/15"
                  >
                    Book a call about this report
                  </a>
                )}
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

        <div ref={summaryRef} className={`bg-ink p-5 sm:p-8 lg:p-10 ${reportOnly}`}>
          <InvestmentSummary estimate={estimate} summary={summary} />
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-white/15 px-4 py-3 text-sm text-white/80 sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-6">
              {analysis.onBest
                ? `This is the best setup for this property: a ${projectPhrase(estimate)}, a size that fits this lot, on the ADU type with the higher ${BEST_SETUP_YEARS}-year return. You can change anything.`
                : `The best setup for this property is a ${analysis.best.sqft.toLocaleString("en-US")} sqft ${projectTitle(analysis.best.projectType).toLowerCase().replace("adu", "ADU")} with the ${finishTitle(analysis.best.finish).toLowerCase()} finish.`}
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

        {report && !team ? (
          <div className={reportOnly}>
            <ScheduleCall report={report} />
          </div>
        ) : null}

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
                    setMap("draw");
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
                    {field.key === "homeValue" && analysis.valueRaised ? (
                      <p className="mt-1 text-xs leading-5 text-ink-soft">
                        Public records list this home at {formatMoney(analysis.valueRaised.listed)}, less than the{" "}
                        {formatMoney(analysis.valueRaised.balance)} in loans on it. A lender wouldn&apos;t lend more than a home is worth, so the listed
                        value is likely out of date and we raised it to the loan balance. If you believe it&apos;s worth more, change it.
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              <MortgageFields analysis={analysis} financing={financing} />
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

        <div className={`flex flex-col gap-4 border-t border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8 lg:px-10 ${reportOnly}`}>
          <div>
            <h3 className="font-display text-2xl text-ink">Place the ADU on your lot</h3>
            <p className="mt-1 text-sm leading-6 text-ink-soft">
              {analysis.footprint
                ? `Placed on the satellite view: ${formatNumber(Math.round(areaSqft(analysis.footprint)))} sqft.`
                : "See your lot from above and draw the ADU where it would go."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMap("open")}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-semibold text-white hover:bg-ink/85"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 4l4-2 4 2 4-2v10l-4 2-4-2-4 2z M6 2v10 M10 4v10" />
            </svg>
            {analysis.footprint ? "Open the lot map" : "Open the satellite map"}
          </button>
        </div>

      </div>

      <LotMapDialog
        mode={map}
        onClose={() => setMap(null)}
        address={property.address}
        latitude={property.latitude}
        longitude={property.longitude}
        footprint={analysis.footprint}
        onFootprint={analysis.setFootprint}
        targetSqft={analysis.sqft}
        onUseSqft={analysis.setSqft}
        canPlace={analysis.projectType !== "garage_conversion"}
      />

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

/** Pinned to the top: what you invest, what the home gains, and what you keep, live as settings change. */
function LiveNumbers({ summary, className, onDone }: { summary: Headline; className: string; onDone: (() => void) | null }) {
  const tone = (value: number) => (value >= 0 ? "text-[#7fd6a8]" : "text-[#f0a37f]");
  return (
    <div className={`fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-ink text-white shadow-lg ${className}`} aria-live="polite">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:gap-6 lg:py-3">
        <p className="hidden w-28 shrink-0 text-[11px] font-semibold uppercase leading-4 tracking-[0.12em] text-white/55 xl:block">Live numbers</p>
        <dl className="grid min-w-0 flex-1 grid-cols-[auto_auto] gap-x-4 gap-y-0.5 lg:grid-cols-[1fr_1fr_1.4fr] lg:gap-6">
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">You invest</dt>
            <dd className="font-display text-base tabular-nums lg:text-2xl">{formatMoney(summary.invest)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Home gains</dt>
            <dd className="font-display text-base tabular-nums text-[#7fd6a8] lg:text-2xl">
              +{formatMoney(summary.valueAdded)}
              <span className="ml-2 hidden font-sans text-xs text-white/60 lg:inline">
                {summary.equity >= 0 ? `${formatMoney(summary.equity)} more than it costs` : `${formatMoney(-summary.equity)} less than it costs`}
              </span>
            </dd>
          </div>
          <div className="col-span-2 min-w-0 lg:col-span-1">
            <dt className="hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55 lg:block">You keep every month</dt>
            <dd className="text-xs tabular-nums text-white/75 lg:text-sm">
              <span className={`font-display text-sm lg:text-2xl ${tone(summary.longTerm)}`}>{formatMoney(summary.longTerm)}</span> lease ·{" "}
              <span className={`font-display text-sm lg:text-2xl ${tone(summary.shortTerm)}`}>{formatMoney(summary.shortTerm)}</span> short-term
              {summary.financed ? <span className="hidden text-white/55 xl:inline"> · after {formatMoney(summary.monthlyDebt)} loans</span> : null}
            </dd>
          </div>
        </dl>
        {onDone ? (
          <button type="button" onClick={onDone} className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-white px-4 text-sm font-semibold text-ink lg:hidden">
            See report
          </button>
        ) : null}
      </div>
    </div>
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

/**
 * The mortgage on the home, next to its value: public records can be stale or odd (a short
 * bridge loan, a paid-off home still showing a loan), so the homeowner can correct it here.
 */
function MortgageFields({
  analysis,
  financing,
}: {
  analysis: ReturnType<typeof useAnalysis>;
  financing: ReturnType<typeof financingFor>;
}) {
  const state = analysis.financing;
  const field = (name: "mortgageBalance" | "currentRate" | "currentPayment") => ({
    id: `financing-${name}`,
    value: state.draft[name],
    onChange: (value: string) => state.setField(name, value),
  });
  const value = state.inputs.homeValue ?? analysis.facts.homeValue;
  const balance = state.inputs.mortgageBalance ?? 0;
  const equity = value == null ? null : value - balance;
  const onRecord = state.onRecord;
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="text-sm font-semibold text-ink">Mortgage</p>
      <p className="mt-1 text-sm leading-6 text-ink-soft">
        {onRecord
          ? `From public records: ${onRecord.openLoans} open loan${onRecord.openLoans === 1 ? "" : "s"}. Match it to your mortgage statement.`
          : "All loans on the home. Leave the balance at 0 if it's paid off."}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field {...field("mortgageBalance")} label="Mortgage balance" unit="$" placeholder="0 if paid off" />
        </div>
        <Field {...field("currentRate")} label="Current rate" unit="%" placeholder="3.5" />
        <Field
          {...field("currentPayment")}
          label="Monthly payment"
          unit="$/mo"
          placeholder={financing.currentPaymentEstimated ? formatMoney(financing.currentPayment).slice(1) : ""}
          hint={onRecord?.interestOnly ? "Short-term loan on record, counted as interest-only" : "Principal and interest"}
        />
      </div>
      {equity != null ? (
        <div className="mt-3 flex items-baseline justify-between gap-3 rounded-lg bg-white px-3 py-2.5 text-sm">
          <span className="text-ink-soft">Current equity</span>
          <span className={`font-semibold tabular-nums ${equity < 0 ? "text-clay" : "text-ink"}`}>
            {equity < 0 ? `-${formatMoney(-equity)}` : formatMoney(equity)}
            {value ? <span className="font-normal text-ink-soft"> · {Math.round((equity / value) * 100)}% of value</span> : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}
