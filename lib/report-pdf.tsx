import "server-only";

import { Document, Line, Page, Path, Rect, renderToBuffer, StyleSheet, Svg, Text, View, type Styles } from "@react-pdf/renderer";
import { createElement } from "react";
import { ASSUMPTIONS } from "./assumptions";
import { BRAND } from "./brand";
import { breakdownSteps, financingFor, headline, settingsUsed, type BreakdownStep, type Headline } from "./breakdown";
import type { Estimate, RentalScenario } from "./calculate";
import { FINANCING, refinanceAfterBuild, type Financing } from "./financing";
import { formatMoney, formatNumber, formatYears } from "./money";
import { bestSetup } from "./optimize";
import { cashOnCash, estimateReport, formatPercent, type ReportRecord } from "./report";

const INK = "#0c0d0c";
const SOFT = "#5b5c58";
const LINE = "#e4e1da";
const PAPER = "#f6f5f1";
const PINE = "#0d5c63";
const PINE_SOFT = "#e3eeee";
const GOOD = "#137a4b";
const MINT = "#7fd6a8";
const CLAY = "#c2562b";
const PEACH = "#f0a37f";
const GOLD = "#b8892b";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 40, paddingBottom: 56, fontFamily: "Helvetica", fontSize: 9, color: INK, lineHeight: 1.35 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: LINE },
  brand: { flexDirection: "row", alignItems: "center", gap: 7 },
  brandText: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  muted: { color: SOFT },
  small: { fontSize: 7.5, color: SOFT },
  eyebrow: { fontSize: 7.5, letterSpacing: 1.4, color: PINE, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  title: { marginTop: 4, fontFamily: "Times-Roman", fontSize: 24, lineHeight: 1.2 },
  h2: { fontFamily: "Times-Roman", fontSize: 19, marginTop: 4, lineHeight: 1.2 },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 6 },
  section: { marginTop: 16 },
  hero: { marginTop: 12, backgroundColor: INK, borderRadius: 10, padding: 15, color: "#ffffff" },
  heroEyebrow: { fontSize: 7, letterSpacing: 1.4, color: "#9a9b97", textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  heroText: { marginTop: 6, fontFamily: "Times-Roman", fontSize: 13.5, lineHeight: 1.3, color: "#ffffff" },
  heroRow: { marginTop: 11, flexDirection: "row", gap: 8 },
  heroBox: { flex: 1, backgroundColor: "#1f201e", borderRadius: 8, padding: 10 },
  heroLabel: { fontSize: 6.5, letterSpacing: 1, color: "#9a9b97", textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  heroValue: { marginTop: 5, fontFamily: "Helvetica-Bold", fontSize: 17, lineHeight: 1.2, color: "#ffffff" },
  heroSub: { marginTop: 5, fontSize: 7.5, color: "#b9bab5", lineHeight: 1.4 },
  columns: { flexDirection: "row", gap: 14 },
  column: { flex: 1 },
  card: { padding: 10, borderWidth: 1, borderColor: LINE, borderRadius: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.8 },
  rowStrong: { flexDirection: "row", justifyContent: "space-between", paddingTop: 5, marginTop: 3, borderTopWidth: 1, borderTopColor: LINE },
  bold: { fontFamily: "Helvetica-Bold" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  chip: { fontSize: 7, color: SOFT, borderWidth: 1, borderColor: LINE, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2.5 },
  step: { marginTop: 7, borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 8 },
  stepHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  stepTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepN: { width: 15, height: 15, borderRadius: 7.5, backgroundColor: INK, alignItems: "center", justifyContent: "center" },
  stepLine: { paddingVertical: 1.6, borderTopWidth: 1, borderTopColor: "#f0eee9" },
  stepLineStrong: { paddingVertical: 2, borderTopWidth: 1, borderTopColor: LINE },
  tableHead: { flexDirection: "row", paddingBottom: 4, fontSize: 7, color: SOFT, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", paddingVertical: 2.4, borderTopWidth: 1, borderTopColor: LINE },
  cellLabel: { flex: 1.5, color: SOFT },
  cell: { flex: 1, textAlign: "right" },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: SOFT },
  disclaimer: { marginTop: 14, fontSize: 7, color: SOFT, lineHeight: 1.45 },
  note: { marginTop: 6, fontSize: 7.5, color: SOFT, lineHeight: 1.45 },
  warn: { marginTop: 5, padding: 6, borderRadius: 6, backgroundColor: "#fbeee8", color: "#8a3a1b", fontSize: 7.5 },
});

/** The built-in PDF fonts have no "−" or "→"; swap in characters they do have. */
const clean = (text: string) => text.replace(/−/g, "-").replace(/ → /g, " to ");
const pct = (rate: number | null, digits = 0) => (rate == null || !Number.isFinite(rate) ? "—" : `${(rate * 100).toFixed(digits)}%`);
const money = (value: number | null) => (value == null ? "—" : formatMoney(value));
const sqftLabel = (value: number | null) => (value == null ? "—" : `${formatNumber(value)} sqft`);
const tone = (value: number) => (value >= 0 ? GOOD : CLAY);

function Mark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 32 32">
      <Rect width={32} height={32} rx={9} fill={INK} />
      <Path d="M8 24.5v-8.2l7-5.8 4.2 3.5M8 24.5h13.5" stroke={PAPER} strokeWidth={2} fill="none" />
      <Path d="M17.5 17.5 24.5 10.5M19.8 10.5h4.7v4.7" stroke="#5fc2b8" strokeWidth={2} fill="none" />
    </Svg>
  );
}

function Header({ address, date }: { address: string; date: string }) {
  return (
    <View style={s.header} fixed>
      <View style={s.brand}>
        <Mark />
        <Text style={s.brandText}>
          {BRAND.short} <Text style={[s.muted, { fontFamily: "Helvetica" }]}>Calculator</Text>
        </Text>
      </View>
      <Text style={s.small}>
        {address.split(",")[0]} · {date}
      </Text>
    </View>
  );
}

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text>{`${BRAND.domain} · Built with ${BRAND.builder} · Estimates, not a bid`}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function Row({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <View style={strong ? s.rowStrong : s.row}>
      <Text style={strong ? s.bold : s.muted}>{clean(label)}</Text>
      <Text style={[strong ? s.bold : {}, color ? { color } : {}]}>{clean(value)}</Text>
    </View>
  );
}

function Card({ title, children, style }: { title: string; children: React.ReactNode; style?: Styles[string] }) {
  return (
    <View style={[s.card, style ?? {}]} wrap={false}>
      <Text style={s.h3}>{title}</Text>
      {children}
    </View>
  );
}

/** A section heading kept on the same page as its first block. */
function SectionTitle({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <View style={{ marginTop: 16 }} wrap={false}>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text style={s.h2}>{title}</Text>
      {intro ? <Text style={[s.note, { marginTop: 2, fontSize: 8.5 }]}>{intro}</Text> : null}
      {children}
    </View>
  );
}

/** Horizontal bars on one scale, for "what goes in vs. what comes out" comparisons. */
function Bars({ rows }: { rows: Array<{ label: string; value: number; color: string; note?: string }> }) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  return (
    <View>
      {rows.map((row) => (
        <View key={row.label} style={{ marginTop: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={s.muted}>
              {row.label}
              {row.note ? <Text style={s.small}> · {row.note}</Text> : null}
            </Text>
            <Text style={[s.bold, { color: row.color === PAPER ? INK : row.color }]}>{formatMoney(row.value)}</Text>
          </View>
          <View style={{ marginTop: 2, height: 7, backgroundColor: PAPER, borderRadius: 3.5 }}>
            <View style={{ height: 7, width: `${Math.max(2, (Math.abs(row.value) / max) * 100)}%`, backgroundColor: row.color, borderRadius: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** One bar split into parts, with a legend: how the build is paid for. */
function StackedBar({ parts }: { parts: Array<{ label: string; value: number; color: string }> }) {
  const shown = parts.filter((part) => part.value > 0);
  const total = shown.reduce((sum, part) => sum + part.value, 0) || 1;
  return (
    <View>
      <View style={{ flexDirection: "row", height: 14, borderRadius: 5, overflow: "hidden", marginTop: 4 }}>
        {shown.map((part) => (
          <View key={part.label} style={{ width: `${(part.value / total) * 100}%`, backgroundColor: part.color }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
        {shown.map((part) => (
          <View key={part.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: part.color }} />
            <Text style={s.small}>
              {part.label} {formatMoney(part.value)} ({pct(part.value / total)})
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function HeroBox({ label, value, color, children }: { label: string; value?: string; color?: string; children: React.ReactNode }) {
  return (
    <View style={s.heroBox}>
      <Text style={s.heroLabel}>{label}</Text>
      {value ? <Text style={[s.heroValue, color ? { color } : {}]}>{value}</Text> : null}
      {children}
    </View>
  );
}

function Hero({ estimate, summary }: { estimate: Estimate; summary: Headline }) {
  const phrase = `${formatNumber(estimate.sqft)} sqft ${estimate.projectLabel.replace(/^\w/, (letter) => letter.toLowerCase())}`;
  const flow = (value: number) => (value >= 0 ? MINT : PEACH);
  return (
    <View style={s.hero} wrap={false}>
      <Text style={s.heroEyebrow}>The short answer</Text>
      <Text style={s.heroText}>
        Invest <Text style={s.bold}>{formatMoney(summary.invest)}</Text> in a {phrase} and your home could be worth{" "}
        <Text style={[s.bold, { color: MINT }]}>{formatMoney(summary.valueAdded)} more</Text>. Rented out, it would leave you{" "}
        <Text style={[s.bold, { color: flow(summary.longTerm) }]}>{formatMoney(summary.longTerm)}</Text> a month on a lease, or{" "}
        <Text style={[s.bold, { color: flow(summary.shortTerm) }]}>{formatMoney(summary.shortTerm)}</Text> as a short-term rental,{" "}
        {summary.financed ? "after the loan payments" : "with no loan payments"}.
      </Text>
      <View style={s.heroRow}>
        <HeroBox label="You invest" value={formatMoney(summary.invest)}>
          <Text style={s.heroSub}>
            {estimate.bedroomLabel} · {estimate.finishLabel} finish{"\n"}Funded by {clean(summary.funding)}
          </Text>
        </HeroBox>
        <HeroBox label="Your home gains" value={`+${formatMoney(summary.valueAdded)}`} color={MINT}>
          <Text style={s.heroSub}>
            {summary.homeValueBefore != null && summary.homeValueAfter != null
              ? `${formatMoney(summary.homeValueBefore)} to ${formatMoney(summary.homeValueAfter)}\n`
              : ""}
            {summary.equity >= 0 ? `${formatMoney(summary.equity)} more than it costs` : `${formatMoney(-summary.equity)} less than it costs`}
          </Text>
        </HeroBox>
        <HeroBox label="You keep every month">
          {[
            ["Long-term lease", summary.longTerm],
            ["Short-term rental", summary.shortTerm],
          ].map(([label, value]) => (
            <View key={label as string} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 5 }}>
              <Text style={{ fontSize: 7.5, color: "#d6d7d2" }}>{label}</Text>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 14, color: flow(value as number) }}>{formatMoney(value as number)}</Text>
            </View>
          ))}
          <Text style={s.heroSub}>{summary.financed ? `After ${formatMoney(summary.monthlyDebt)} / mo in loan payments` : "Net rent, paid in cash"}</Text>
          {summary.afterRefinance ? (
            <Text style={[s.heroSub, { color: MINT }]}>
              After the refinance: {formatMoney(summary.afterRefinance.longTerm)} lease · {formatMoney(summary.afterRefinance.shortTerm)} short-term
            </Text>
          ) : null}
        </HeroBox>
      </View>
    </View>
  );
}

function Step({ step }: { step: BreakdownStep }) {
  return (
    <View style={s.step} wrap={false}>
      <View style={s.stepHead}>
        <View style={s.stepTitle}>
          <View style={s.stepN}>
            <Text style={{ color: "#ffffff", fontSize: 7.5, fontFamily: "Helvetica-Bold", lineHeight: 1 }}>{step.n}</Text>
          </View>
          <Text style={[s.bold, { fontSize: 10 }]}>{step.title}</Text>
        </View>
        <Text style={[s.bold, { fontSize: 11 }]}>{clean(step.result)}</Text>
      </View>
      {step.lines.map((line, index) => (
        <View key={`${index}-${line.label}`} style={line.strong ? s.stepLineStrong : s.stepLine}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={line.strong ? s.bold : {}}>{line.label}</Text>
            <Text style={line.strong ? s.bold : {}}>{clean(line.value)}</Text>
          </View>
          {line.math ? <Text style={{ fontSize: 7, color: SOFT, marginTop: 0.5 }}>{clean(line.math)}</Text> : null}
        </View>
      ))}
      {step.note ? <Text style={s.note}>{clean(step.note)}</Text> : null}
    </View>
  );
}

/** Cumulative cash flow, years 0–15, with dollar and year axes. */
function CashChart({ scenarios }: { scenarios: RentalScenario[] }) {
  const axis = 52;
  const width = 478;
  const height = 120;
  const values = scenarios.flatMap((scenario) => scenario.series.map((point) => point.cumulative));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const years = ASSUMPTIONS.operations.projectionYears;
  const x = (year: number) => (year / years) * width;
  const y = (value: number) => ((max - value) / span) * height;
  const path = (scenario: RentalScenario) =>
    scenario.series.map((point, i) => `${i === 0 ? "M" : "L"}${x(point.year).toFixed(1)},${y(point.cumulative).toFixed(1)}`).join(" ");
  const ticks = [max, max / 2, 0, min / 2, min].filter((value, index, all) => all.indexOf(value) === index && (value !== 0 || index === 2));
  return (
    <View>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: axis, height, position: "relative" }}>
          {ticks.map((value) => (
            <Text key={value} style={{ position: "absolute", right: 6, top: y(value) - 4, fontSize: 6.5, color: SOFT }}>
              {formatMoney(Math.round(value / 1000) * 1000)}
            </Text>
          ))}
        </View>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {ticks.map((value) => (
            <Line key={value} x1={0} y1={y(value)} x2={width} y2={y(value)} stroke={value === 0 ? "#bdbab2" : "#efede8"} strokeWidth={value === 0 ? 1 : 0.6} />
          ))}
          {scenarios.map((scenario) => (
            <Path key={scenario.id} d={path(scenario)} stroke={scenario.id === "long_term" ? PINE : CLAY} strokeWidth={2} fill="none" />
          ))}
        </Svg>
      </View>
      <View style={{ flexDirection: "row", marginLeft: axis, marginTop: 3, justifyContent: "space-between" }}>
        {[0, 5, 10, 15].map((year) => (
          <Text key={year} style={{ fontSize: 6.5, color: SOFT }}>
            Year {year}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 14, marginTop: 6, marginLeft: axis }}>
        {scenarios.map((scenario) => (
          <View key={scenario.id} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 10, height: 2.5, backgroundColor: scenario.id === "long_term" ? PINE : CLAY }} />
            <Text style={s.small}>
              {scenario.id === "long_term" ? "Long-term lease" : "Short-term rental"} · pays back in {formatYears(scenario.breakEvenYears)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Table({ head, rows, widths }: { head: string[]; rows: Array<Array<string | { text: string; color?: string; bold?: boolean }>>; widths?: number[] }) {
  const flex = (index: number) => ({ flex: widths?.[index] ?? (index === 0 ? 1.5 : 1) });
  return (
    <View>
      <View style={s.tableHead}>
        {head.map((label, index) => (
          <Text key={`${index}-${label}`} style={[flex(index), { textAlign: index === 0 ? "left" : "right" }]}>
            {label}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={s.tableRow}>
          {row.map((cell, index) => {
            const value = typeof cell === "string" ? { text: cell } : cell;
            return (
              <Text
                key={index}
                style={[flex(index), { textAlign: index === 0 ? "left" : "right" }, index === 0 ? s.muted : {}, value.bold ? s.bold : {}, value.color ? { color: value.color } : {}]}
              >
                {clean(value.text)}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** "ADU-ROI-Report-2543-Walnut-Ave.pdf" */
export function pdfFileName(report: ReportRecord): string {
  const street = report.property.address.split(",")[0].replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
  return `ADU-ROI-Report-${street || "property"}.pdf`;
}

/** The report PDF as bytes, for the download route and the email attachment. */
export async function renderReportPdf(report: ReportRecord): Promise<Uint8Array<ArrayBuffer>> {
  const pdf = await renderToBuffer(createElement(ReportPdf, { report }) as Parameters<typeof renderToBuffer>[0]);
  return new Uint8Array(pdf);
}

export function ReportPdf({ report }: { report: ReportRecord }) {
  const { property, inputs } = report;
  const estimate = inputs ? estimateReport(inputs) : null;
  const date = new Date(report.updatedAt).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Los_Angeles" });

  return (
    <Document title={`ADU ROI report – ${property.address}`} author={BRAND.name} creator={BRAND.name}>
      {estimate && inputs ? (
        <FullReport report={report} estimate={estimate} financing={financingFor(inputs.financing, estimate)} date={date} />
      ) : (
        <Page size="LETTER" style={s.page}>
          <Header address={property.address} date={date} />
          <Text style={[s.eyebrow, { marginTop: 22 }]}>ADU ROI report</Text>
          <Text style={s.title}>{property.address}</Text>
          <Card title="Next step" style={{ marginTop: 16 }}>
            <Text style={s.muted}>Choose an ADU type in the calculator to complete this report.</Text>
          </Card>
          <Footer />
        </Page>
      )}
    </Document>
  );
}

function FullReport({ report, estimate, financing, date }: { report: ReportRecord; estimate: Estimate; financing: Financing; date: string }) {
  const { property } = report;
  const summary = headline(estimate, financing);
  const steps = breakdownSteps(estimate, financing);
  const { longTerm, shortTerm } = estimate.scenarios;
  const debt = financing.monthlyDebt;
  const refinance = financing.plan === "refinance";
  const after = refinanceAfterBuild(financing, estimate.blendedUplift);
  const homeBefore = summary.homeValueBefore;
  const best = bestSetup({ homeSquareFootage: property.squareFootage, homeValue: property.homeValue, lotSize: property.lotSize });
  const onBest = best.projectType === estimate.projectType && best.sqft === estimate.sqft && best.finish === estimate.finish;
  const total15 = (scenario: RentalScenario) => scenario.series.slice(1).reduce((sum, point) => sum + point.net, 0);
  const rentSource =
    estimate.rentSource === "rentcast" ? "RentCast rent comps" : estimate.rentSource === "manual" ? "Homeowner's figure" : "Los Angeles planning rate";

  return (
    <>
      {/* Page 1: the answer, at a glance. */}
      <Page size="LETTER" style={s.page}>
        <Header address={property.address} date={date} />
        <Text style={[s.eyebrow, { marginTop: 14 }]}>ADU ROI report</Text>
        <Text style={s.title}>{property.address}</Text>
        <Text style={[s.muted, { marginTop: 4 }]}>
          {report.createdBy === "team" ? `Prepared by ${BRAND.builder}` : `Prepared for ${report.name}`} · {date}
        </Text>

        <Hero estimate={estimate} summary={summary} />
        {onBest ? (
          <Text style={[s.note, { color: PINE }]}>
            This is the best setup for this property: a {estimate.projectLabel.replace(/^\w/, (letter) => letter.toLowerCase())} sized to fit this lot, on the ADU type with the higher 10-year return.
          </Text>
        ) : null}

        <View style={[s.columns, { marginTop: 10 }]}>
          <Card title="Value vs. cost" style={{ flex: 1 }}>
            <Bars
              rows={[
                { label: "Total investment", value: estimate.total, color: CLAY },
                { label: "Value added", value: estimate.blendedUplift, color: PINE },
                { label: "Equity created", value: estimate.equity, color: tone(estimate.equity) },
              ]}
            />
            <Text style={s.note}>
              Every $1 put in adds about ${(estimate.total > 0 ? estimate.blendedUplift / estimate.total : 0).toFixed(2)} of home value.
            </Text>
          </Card>
          <Card title="Each month" style={{ flex: 1 }}>
            <Bars
              rows={[
                { label: "Lease net rent", value: longTerm.monthlyNet, color: PINE },
                { label: "Short-term net rent", value: shortTerm.monthlyNet, color: GOLD },
                { label: "Loan payments", value: debt, color: CLAY },
                { label: "You keep, lease", value: summary.longTerm, color: tone(summary.longTerm) },
                { label: "You keep, short-term", value: summary.shortTerm, color: tone(summary.shortTerm) },
              ]}
            />
          </Card>
        </View>

        <View style={[s.columns, { marginTop: 10 }]}>
          <Card title="Your property" style={{ flex: 1 }}>
            <Row label="Home size" value={sqftLabel(property.squareFootage)} />
            <Row label="Lot size" value={sqftLabel(property.lotSize)} />
            <Row label="Bedrooms / bathrooms" value={`${property.bedrooms ?? "—"} / ${property.bathrooms ?? "—"}`} />
            <Row label="Year built" value={property.yearBuilt == null ? "—" : String(property.yearBuilt)} />
            <Row label="Property type" value={property.propertyType ?? "—"} />
            <Row label="Estimated value" value={money(property.homeValue)} />
            <Row label="Value per sqft" value={estimate.usedFallbackValuePerSqft ? `${formatMoney(estimate.valuePerSqft)} (planning rate)` : formatMoney(estimate.valuePerSqft)} />
          </Card>
          <Card title="Your ADU" style={{ flex: 1 }}>
            <Row label="Type" value={estimate.projectLabel} />
            <Row label="Size" value={`${formatNumber(estimate.sqft)} sqft · ${estimate.bedroomLabel}`} />
            <Row label="Finish" value={estimate.finishLabel} />
            <Row label="Adds to living space" value={property.squareFootage ? `+${pct(estimate.sqft / property.squareFootage)}` : "—"} />
            <Row label="Share of the lot" value={property.lotSize ? pct(estimate.sqft / property.lotSize) : "—"} />
            <Row label="Cost per sqft, all in" value={formatMoney(estimate.total / estimate.sqft)} />
            <Row label="Home value after" value={money(estimate.newHomeValue)} />
          </Card>
        </View>
        <Footer />
      </Page>

      {/* The detail, flowing from page 2: the math, rental income, year by year, financing, value, assumptions. */}
      <Page size="LETTER" style={s.page}>
        <Header address={property.address} date={date} />
        <SectionTitle eyebrow="Step by step" title="How we got these numbers" intro="Every figure on page 1, worked out with this report's own settings.">
          <View style={s.chips}>
            {settingsUsed(estimate, financing, property).map((setting) => (
              <Text key={setting} style={s.chip}>
                {clean(setting)}
              </Text>
            ))}
          </View>
        </SectionTitle>
        {/* Two columns of steps so the whole explanation fits on one page. */}
        <View style={[s.columns, { gap: 10 }]}>
          <View style={s.column}>
            {(steps[5] ? [steps[0], steps[1]] : [steps[0], steps[1], steps[4]]).map((step) => (
              <Step key={step.n} step={step} />
            ))}
          </View>
          <View style={s.column}>
            {[steps[2], steps[3]].map((step) => (
              <Step key={step.n} step={step} />
            ))}
          </View>
        </View>
        {steps[5] ? (
          // With a refinance after the build, what you keep before and after it sit side by side.
          <View style={[s.columns, { gap: 10 }]} wrap={false}>
            <View style={s.column}>
              <Step step={steps[4]} />
            </View>
            <View style={s.column}>
              <Step step={steps[5]} />
            </View>
          </View>
        ) : null}
        <View style={[s.card, { marginTop: 12 }]} wrap={false}>
          <Text style={s.h3}>Cumulative cash flow over 15 years, before loan payments</Text>
          <Text style={[s.small, { marginBottom: 8 }]}>Starts at minus the project cost; the line crosses zero when the rent has paid it back.</Text>
          <CashChart scenarios={[longTerm, shortTerm]} />
        </View>

        <SectionTitle eyebrow="Rental income" title="Lease or short-term rental" intro="The same ADU two ways. Net is after vacancy or management and the added property tax, before loan payments.">
        <View style={[s.card, { marginTop: 10 }]}>
          <Table
            head={["", "Long-term lease", "Short-term rental"]}
            rows={[
              ["Rent basis", `${formatMoney(longTerm.monthlyGross)} / mo`, `${formatMoney(shortTerm.nightlyRate ?? 0)} / night`],
              ["Occupancy", pct(1 - ASSUMPTIONS.operations.vacancyRate), `${pct(shortTerm.occupancy)} (${Math.round((shortTerm.occupancy ?? 0) * ASSUMPTIONS.shortTerm.daysPerMonth)} nights / mo)`],
              ["Gross / month", formatMoney(longTerm.monthlyGross), formatMoney(shortTerm.monthlyGross)],
              ["Gross / year", formatMoney(longTerm.annualGross), formatMoney(shortTerm.annualGross)],
              ...[0, 1].map((index) => [
                `${longTerm.lines[index]?.label ?? ""} / ${shortTerm.lines[index]?.label ?? ""}`.replace("Added property tax / Added property tax", "Added property tax"),
                `-${formatMoney(longTerm.lines[index]?.amount ?? 0)}`,
                `-${formatMoney(shortTerm.lines[index]?.amount ?? 0)}`,
              ]),
              [{ text: "Net / year", bold: true }, { text: formatMoney(longTerm.annualNet), bold: true }, { text: formatMoney(shortTerm.annualNet), bold: true }],
              [{ text: "Net / month", bold: true }, { text: formatMoney(longTerm.monthlyNet), bold: true }, { text: formatMoney(shortTerm.monthlyNet), bold: true }],
              ["Loan payments / month", `-${formatMoney(debt)}`, `-${formatMoney(debt)}`],
              [
                { text: "You keep / month", bold: true },
                { text: formatMoney(summary.longTerm), bold: true, color: tone(summary.longTerm) },
                { text: formatMoney(summary.shortTerm), bold: true, color: tone(summary.shortTerm) },
              ],
              ["Gross yield (gross ÷ cost)", pct(longTerm.annualGross / estimate.total, 1), pct(shortTerm.annualGross / estimate.total, 1)],
              ["Cash-on-cash (net ÷ cost)", formatPercent(cashOnCash(longTerm.annualNet, estimate.total)), formatPercent(cashOnCash(shortTerm.annualNet, estimate.total))],
              ["Payback with 3% rent growth", formatYears(longTerm.breakEvenYears), formatYears(shortTerm.breakEvenYears)],
              ["Simple payback, no growth", formatYears(longTerm.simplePaybackYears), formatYears(shortTerm.simplePaybackYears)],
              ["Net rent over 15 years", formatMoney(total15(longTerm)), formatMoney(total15(shortTerm))],
            ]}
          />
          <Text style={s.note}>
            Lease rent: {rentSource}
            {estimate.rentLow != null && estimate.rentHigh != null ? `, range ${formatMoney(estimate.rentLow)}–${formatMoney(estimate.rentHigh)}` : ""} ·{" "}
            {formatMoney(longTerm.monthlyGross / estimate.sqft).replace(/\.\d+$/, "")} per sqft a month. Short-term: {shortTerm.sourceNote}.
          </Text>
        </View>
        </SectionTitle>

        <Text style={s.disclaimer}>
          Short-term rentals of ADUs may be restricted by local rules. Los Angeles&apos;s home-sharing ordinance limits registration, primary-residence use, and how many nights
          a host can rent. Confirm the rules for this address before counting on nightly income.
        </Text>
        <SectionTitle eyebrow="Year by year" title="15-year projection" intro={`Rent grows ${pct(ASSUMPTIONS.operations.rentGrowthRate)} a year and the added property tax ${pct(ASSUMPTIONS.operations.propertyTaxGrowthRate)}.`}>
        <View style={[s.card, { marginTop: 10 }]}>
          <Table
            head={["Year", "Lease net", "Lease cumulative", "Short-term net", "Short-term cumulative"]}
            widths={[0.6, 1, 1.2, 1, 1.2]}
            rows={longTerm.series.slice(1).map((point, index) => {
              const other = shortTerm.series[index + 1];
              return [
                String(point.year),
                formatMoney(point.net),
                { text: formatMoney(point.cumulative), color: tone(point.cumulative) },
                formatMoney(other?.net ?? 0),
                { text: formatMoney(other?.cumulative ?? 0), color: tone(other?.cumulative ?? 0) },
              ];
            })}
          />
        </View>
        </SectionTitle>

        <View style={[s.columns, { marginTop: 12 }]}>
          <Card title={refinance ? "Paying for it: refinance + loan" : "Paying for it: cash"} style={{ flex: 1 }}>
            <StackedBar
              parts={[
                { label: "Refinance", value: financing.cashOut, color: PINE },
                { label: "Unsecured loan", value: financing.unsecuredAmount, color: GOLD },
                { label: "Savings", value: financing.cashFromOwner, color: "#9a9b97" },
              ]}
            />
            <View style={{ marginTop: 6 }}>
              {refinance ? (
                <>
                  {financing.cashDown > 0 ? <Row label="Cash you put in" value={formatMoney(financing.cashDown)} /> : null}
                  <Row label="Home value used" value={formatMoney(financing.homeValue)} />
                  <Row label="Mortgage balance" value={formatMoney(financing.mortgageBalance)} />
                  <Row label="Equity today" value={formatMoney(financing.equity)} />
                  <Row label={`Cash-out available at ${pct(FINANCING.maxLoanToValue)} LTV`} value={formatMoney(financing.cashOutAvailable)} />
                  <Row label={`New loan, ${pct(financing.refiRate, 2)} for ${FINANCING.refiYears} yrs`} value={formatMoney(financing.newLoan)} />
                  <Row label="Mortgage payment" value={`${formatMoney(financing.currentPayment)} to ${formatMoney(financing.newPayment)}`} />
                  <Row label={`Unsecured, ${pct(financing.unsecuredRate, 2)} for ${financing.unsecuredYears} yrs`} value={`${formatMoney(financing.unsecuredPayment)} / mo`} />
                  <Row label="Loan-to-value after" value={formatPercent(financing.loanToValueAfter)} />
                </>
              ) : null}
              <Row label="From savings in all" value={formatMoney(financing.cashFromOwner)} />
              <Row label="Added loan payments" value={`${formatMoney(debt)} / mo`} strong />
            </View>
            {after ? (
              <View style={{ marginTop: 8, padding: 7, borderRadius: 6, backgroundColor: PINE_SOFT }}>
                <Text style={{ fontSize: 7.5, color: PINE, fontFamily: "Helvetica-Bold" }}>Once it&apos;s built: refinance the loan</Text>
                <Text style={{ fontSize: 7.5, color: PINE, lineHeight: 1.4, marginTop: 2 }}>
                  Appraised at about {formatMoney(after.appraisedValue)} with the ADU, one {formatMoney(after.newLoan)} mortgage at {pct(financing.refiRate, 2)} pays off{" "}
                  {formatMoney(after.unsecuredPaidOff)} of the unsecured loan.{" "}
                  {after.monthlySavings > 0
                    ? `Loan payments drop to ${formatMoney(after.monthlyDebt)} / mo, ${formatMoney(after.monthlySavings)} less.`
                    : "Here the closing costs on the new mortgage outweigh the lower rate, so keeping the personal loan is cheaper."}
                </Text>
              </View>
            ) : null}
            {financing.warnings.map((warning) => (
              <Text key={warning} style={s.warn}>
                {warning}
              </Text>
            ))}
          </Card>
          <Card title="What it adds to your home" style={{ flex: 1 }}>
            <Row label="Home value per sqft" value={formatMoney(estimate.valuePerSqft)} />
            <Row label={`Square-foot approach (${pct(ASSUMPTIONS.value.sqftFactor[estimate.projectType])} credit)`} value={formatMoney(estimate.sqftUplift)} />
            <Row label={`Income approach (${pct(ASSUMPTIONS.value.capRate, 1)} cap rate)`} value={money(estimate.incomeUplift)} />
            <Row label={`Blend, ${pct(ASSUMPTIONS.value.sqftApproachWeight)} / ${pct(1 - ASSUMPTIONS.value.sqftApproachWeight)}`} value={formatMoney(estimate.blendedUplift)} strong />
            <Row label="Home value before" value={money(homeBefore)} />
            <Row label="Home value after" value={money(estimate.newHomeValue)} />
            <Row label="Equity created" value={formatMoney(estimate.equity)} color={tone(estimate.equity)} strong />
            <View style={{ marginTop: 8, padding: 7, borderRadius: 6, backgroundColor: PINE_SOFT }}>
              <Text style={{ fontSize: 7.5, color: PINE, lineHeight: 1.4 }}>
                Appraisers value an ADU partly by its size and partly by the rent it earns. We blend the two so neither one alone drives the number.
              </Text>
            </View>
          </Card>
        </View>
        <SectionTitle eyebrow="Fine print" title="Every assumption we used" />
        <View style={{ marginTop: 8 }}>
          {[...estimate.warnings, ...estimate.notes].map((note, index) => (
            <View key={index} style={{ flexDirection: "row", gap: 6, marginTop: 5 }}>
              <Text style={{ color: PINE }}>•</Text>
              <Text style={{ flex: 1, fontSize: 8.5, lineHeight: 1.45 }}>{note}</Text>
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 6, marginTop: 5 }}>
            <Text style={{ color: PINE }}>•</Text>
            <Text style={{ flex: 1, fontSize: 8.5, lineHeight: 1.45 }}>
              Financing is an estimate, not a loan offer. A lender sets the amount and rate from credit, income and an appraisal. The refinance assumes a {FINANCING.refiYears}-year fixed loan
              with {pct(FINANCING.closingCostRate)} closing costs rolled in, up to {pct(FINANCING.maxLoanToValue)} of the home&apos;s value. Payments are principal and interest.
            </Text>
          </View>
        </View>
        <Text style={s.disclaimer}>
          Estimates, not a bid. Construction costs, rent, taxes, and resale value vary. Confirm figures with a licensed contractor, a designer, a lender and a tax advisor before you spend
          money. Prepared by {BRAND.name} ({BRAND.domain}) with {BRAND.builder}.
        </Text>
        <Footer />
      </Page>
    </>
  );
}
