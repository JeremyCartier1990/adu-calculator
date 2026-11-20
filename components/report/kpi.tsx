/** One headline number in the dark KPI band. */
export function Kpi({
  label,
  value,
  note,
  tone,
  wide = false,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "good" | "warn";
  wide?: boolean;
}) {
  return (
    <div className={`bg-ink px-4 py-4 sm:px-5 sm:py-5 ${wide ? "col-span-2 md:col-span-1" : ""}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{label}</dt>
      <dd
        className={`mt-2 font-display text-[1.7rem] leading-none tabular-nums sm:text-3xl ${
          tone === "good" ? "text-[#7fd6a8]" : tone === "warn" ? "text-[#f0a37f]" : "text-white"
        }`}
      >
        {value}
      </dd>
      {note ? <p className="mt-1.5 text-xs text-white/55">{note}</p> : null}
    </div>
  );
}

/** The five headline numbers on a dark band, shared by the live analysis and the saved report. */
export function KpiBand({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/12 md:grid-cols-5">{children}</dl>
  );
}
