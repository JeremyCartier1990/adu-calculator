export function Mark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#234237" />
      <path d="M6.5 15.2 16 7.2l9.5 8" fill="none" stroke="#F4EFE6" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 14.8V24.2h14V14.8" fill="none" stroke="#F4EFE6" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14.2 24.2v-5.2h3.6v5.2" fill="none" stroke="#E7B9A4" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 backdrop-blur">
      <a className="skip-link" href="#calculator">
        Skip to calculator
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <a href="#top" className="flex items-center gap-2.5">
          <Mark />
          <span>
            <span className="block font-serif text-lg leading-none text-ink">Home First</span>
            <span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.16em] text-ink-soft">Remodel</span>
          </span>
        </a>
        <nav aria-label="Page" className="flex items-center gap-4">
          <a href="#how-it-works" className="hidden text-sm font-medium text-ink-soft hover:text-ink sm:inline">
            How it works
          </a>
          <a href="#calculator" className="hidden text-sm font-medium text-ink-soft hover:text-ink sm:inline">
            Calculator
          </a>
          <a
            href="#consultation"
            className="inline-flex min-h-11 items-center rounded-full bg-clay px-4 text-sm font-semibold text-white hover:bg-clay-dark"
          >
            Free consultation
          </a>
        </nav>
      </div>
    </header>
  );
}
