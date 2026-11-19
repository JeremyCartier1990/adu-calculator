export function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "warn" }) {
  return (
    <div className="bg-surface px-4 py-4 sm:px-5">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className={`mt-1.5 text-2xl font-semibold tracking-tight tabular-nums ${tone === "good" ? "text-good" : tone === "warn" ? "text-clay" : ""}`}>
        {value}
      </dd>
      {note ? <p className="mt-0.5 text-xs text-ink-soft">{note}</p> : null}
    </div>
  );
}
