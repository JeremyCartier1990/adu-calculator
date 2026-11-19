/** Small section label: a pill with a plan-grid icon, in the tone of the section it sits on. */
export function Eyebrow({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-md py-1 pl-1 pr-3 text-[11px] font-semibold uppercase tracking-[0.12em] ${
        dark ? "bg-white/10 text-white" : "bg-ink/[0.06] text-ink"
      }`}
    >
      <span className={`grid h-6 w-6 place-items-center rounded ${dark ? "bg-white text-ink" : "bg-ink text-white"}`} aria-hidden="true">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2.5" y="2.5" width="11" height="11" />
          <path d="M2.5 8h11M8 2.5v11" />
        </svg>
      </span>
      {children}
    </p>
  );
}

/** The arrow square that leads every primary button. */
export function ArrowBox({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${tone === "dark" ? "bg-white/15 text-white" : "bg-ink text-white"}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" />
      </svg>
    </span>
  );
}
