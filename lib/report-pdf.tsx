import "server-only";

import { Document, Line, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { bedroomLabel } from "./assumptions";
import { BRAND } from "./brand";
import { calculateEstimate, type RentalScenario } from "./calculate";
import { formatMoney, formatNumber, formatYears } from "./money";
import { cashOnCash, formatPercent, type ReportRecord } from "./report";

const INK = "#0c0d0c";
const SOFT = "#5b5c58";
const LINE = "#e4e1da";
const PAPER = "#f6f5f1";
const PINE = "#0d5c63";
const GOOD = "#137a4b";
const CLAY = "#c2562b";

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingHorizontal: 40, paddingBottom: 60, fontFamily: "Helvetica", fontSize: 9.5, color: INK, lineHeight: 1.35 },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { flexDirection: "row", alignItems: "center", gap: 7 },
  brandText: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  muted: { color: SOFT },
  eyebrow: { marginTop: 26, fontSize: 8, letterSpacing: 1.6, color: PINE, textTransform: "uppercase" },
  title: { marginTop: 6, fontFamily: "Times-Roman", fontSize: 26, lineHeight: 1.1 },
  kpis: { marginTop: 18, flexDirection: "row", borderWidth: 1, borderColor: LINE, borderRadius: 8 },
  kpi: { flex: 1, padding: 10, borderRightWidth: 1, borderRightColor: LINE },
  kpiLast: { flex: 1, padding: 10 },
  kpiLabel: { fontSize: 7, letterSpacing: 0.6, color: SOFT, textTransform: "uppercase" },
  kpiValue: { marginTop: 4, fontFamily: "Helvetica-Bold", fontSize: 13 },
  columns: { marginTop: 14, flexDirection: "row", gap: 14 },
  column: { flex: 1 },
  card: { marginTop: 14, padding: 12, borderWidth: 1, borderColor: LINE, borderRadius: 8 },
  cardTitle: { fontFamily: "Times-Roman", fontSize: 15, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5 },
  rowStrong: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, marginTop: 3, borderTopWidth: 1, borderTopColor: LINE },
  bold: { fontFamily: "Helvetica-Bold" },
  tableHead: { flexDirection: "row", paddingBottom: 4, fontSize: 7.5, color: SOFT, textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderTopWidth: 1, borderTopColor: LINE },
  cellLabel: { flex: 1.4, color: SOFT },
  cell: { flex: 1, textAlign: "right" },
  footerLeft: { position: "absolute", bottom: 24, left: 40, fontSize: 7, color: SOFT },
  disclaimer: { marginTop: 16, fontSize: 7.5, color: SOFT },
});

function Mark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 32 32">
      <Rect width={32} height={32} rx={9} fill={INK} />
      <Path d="M8 24.5v-8.2l7-5.8 4.2 3.5M8 24.5h13.5" stroke={PAPER} strokeWidth={2} fill="none" />
      <Path d="M17.5 17.5 24.5 10.5M19.8 10.5h4.7v4.7" stroke="#5fc2b8" strokeWidth={2} fill="none" />
    </Svg>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={strong ? s.rowStrong : s.row}>
      <Text style={strong ? s.bold : s.muted}>{label}</Text>
      <Text style={strong ? s.bold : undefined}>{value}</Text>
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card} wrap={false}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** Cumulative cash flow, years 0–15, as a simple line with a zero axis. */
function CashChart({ scenario }: { scenario: RentalScenario }) {
  const width = 500;
  const height = 120;
  const values = scenario.series.map((point) => point.cumulative);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (year: number) => (year / 15) * width;
  const y = (value: number) => ((max - value) / span) * height;
  const d = scenario.series.map((point, i) => `${i === 0 ? "M" : "L"}${x(point.year).toFixed(1)},${y(point.cumulative).toFixed(1)}`).join(" ");
  return (
    <View style={{ marginTop: 8 }}>
      <Svg width={width} height={height + 4} viewBox={`0 -2 ${width} ${height + 4}`}>
        <Line x1={0} y1={y(0)} x2={width} y2={y(0)} stroke={LINE} strokeWidth={1} />
        <Path d={d} stroke={PINE} strokeWidth={2} fill="none" />
      </Svg>
      <View style={[s.row, { paddingVertical: 2 }]}>
        <Text style={s.muted}>Year 0: {formatMoney(values[0] ?? 0)}</Text>
        <Text style={s.muted}>Cumulative cash flow, {scenario.label.toLowerCase()}</Text>
        <Text style={s.muted}>Year 15: {formatMoney(values[values.length - 1] ?? 0)}</Text>
      </View>
    </View>
  );
}

export function ReportPdf({ report }: { report: ReportRecord }) {
  const { property, inputs } = report;
  const estimate = inputs ? calculateEstimate(inputs) : null;
  const active = estimate ? (estimate.rentalUse === "short_term" ? estimate.scenarios.shortTerm : estimate.scenarios.longTerm) : null;
  const date = new Date(report.updatedAt).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Los_Angeles" });
  const sqft = (value: number | null) => (value == null ? "—" : `${formatNumber(value)} sqft`);

  return (
    <Document title={`ADU ROI report – ${property.address}`} author={BRAND.name} creator={BRAND.name}>
      <Page size="LETTER" style={s.page}>
        <View style={s.brandRow}>
          <View style={s.brand}>
            <Mark />
            <Text style={s.brandText}>
              {BRAND.short} <Text style={[s.muted, { fontFamily: "Helvetica" }]}>Calculator</Text>
            </Text>
          </View>
          <Text style={s.muted}>{date}</Text>
        </View>

        <Text style={s.eyebrow}>ADU ROI report</Text>
        <Text style={s.title}>{property.address}</Text>
        <Text style={[s.muted, { marginTop: 4 }]}>Prepared for {report.name}</Text>

        {estimate && active ? (
          <>
            <View style={s.kpis}>
              {[
                ["Project cost", formatMoney(estimate.total), INK],
                ["Net income / mo", formatMoney(active.monthlyNet), INK],
                ["Cash-on-cash", formatPercent(cashOnCash(active.annualNet, estimate.total)), INK],
                ["Payback", formatYears(active.breakEvenYears), INK],
                ["Equity created", formatMoney(estimate.equity), estimate.equity >= 0 ? GOOD : CLAY],
              ].map(([label, value, color], index, all) => (
                <View key={label} style={index === all.length - 1 ? s.kpiLast : s.kpi}>
                  <Text style={s.kpiLabel}>{label}</Text>
                  <Text style={[s.kpiValue, { color }]}>{value}</Text>
                </View>
              ))}
            </View>

            <View style={s.columns}>
              <View style={s.column}>
                <Card title="Selected project">
                  <Row label="ADU type" value={estimate.projectLabel} />
                  <Row label="Size" value={`${formatNumber(estimate.sqft)} sqft · ${bedroomLabel(estimate.bedrooms)}`} />
                  <Row label="Finish" value={estimate.finishLabel} />
                  <Row label="Rental plan" value={active.label} />
                </Card>
                <Card title="Project cost">
                  <Row label="Construction" value={formatMoney(estimate.construction)} />
                  <Row label="Architectural plans" value={formatMoney(estimate.design)} />
                  <Row label="City permits" value={formatMoney(estimate.cityFees)} />
                  <Row label="School & impact fees" value={formatMoney(estimate.schoolFees)} />
                  <Row label="Utility connections" value={formatMoney(estimate.utilityFees)} />
                  <Row label="Total project cost" value={formatMoney(estimate.total)} strong />
                </Card>
              </View>
              <View style={s.column}>
                <Card title="Property">
                  <Row label="Home size" value={sqft(property.squareFootage)} />
                  <Row label="Lot size" value={sqft(property.lotSize)} />
                  <Row label="Beds / baths" value={`${property.bedrooms ?? "—"} / ${property.bathrooms ?? "—"}`} />
                  <Row label="Year built" value={property.yearBuilt == null ? "—" : String(property.yearBuilt)} />
                  <Row label="Estimated value" value={property.homeValue == null ? "—" : formatMoney(property.homeValue)} />
                </Card>
                <Card title="Value & equity">
                  <Row label="Blended value added" value={formatMoney(estimate.blendedUplift)} />
                  <Row label="New estimated home value" value={estimate.newHomeValue == null ? "—" : formatMoney(estimate.newHomeValue)} />
                  <Row label="Equity vs. cost" value={formatMoney(estimate.equity)} strong />
                </Card>
              </View>
            </View>

            <Card title="Rental income">
              <View style={s.tableHead}>
                <Text style={s.cellLabel} />
                <Text style={s.cell}>Long-term lease{estimate.rentalUse === "long_term" ? " (selected)" : ""}</Text>
                <Text style={s.cell}>Short-term rental{estimate.rentalUse === "short_term" ? " (selected)" : ""}</Text>
              </View>
              {(
                [
                  ["Gross / month", (x) => formatMoney(x.monthlyGross)],
                  ["Net / year", (x) => formatMoney(x.annualNet)],
                  ["Net / month", (x) => formatMoney(x.monthlyNet)],
                  ["Cash-on-cash", (x) => formatPercent(cashOnCash(x.annualNet, estimate.total))],
                  ["Payback with rent growth", (x) => formatYears(x.breakEvenYears)],
                ] as Array<[string, (x: RentalScenario) => string]>
              ).map(([label, value]) => (
                <View key={label} style={s.tableRow}>
                  <Text style={s.cellLabel}>{label}</Text>
                  <Text style={s.cell}>{value(estimate.scenarios.longTerm)}</Text>
                  <Text style={s.cell}>{value(estimate.scenarios.shortTerm)}</Text>
                </View>
              ))}
              <CashChart scenario={active} />
            </Card>
          </>
        ) : (
          <Card title="Next step">
            <Text style={s.muted}>Choose an ADU type in the calculator to complete this report.</Text>
          </Card>
        )}

        <Text style={s.disclaimer}>
          Estimates, not a bid. Construction costs, rent, taxes, and resale value vary. Short-term rentals may be limited by local
          rules. Confirm figures with a licensed contractor, a designer, and a tax advisor before you spend money.
        </Text>

        <Text style={s.footerLeft} fixed>
          {`${BRAND.domain} · Built with ${BRAND.builder}`}
        </Text>
      </Page>
    </Document>
  );
}
