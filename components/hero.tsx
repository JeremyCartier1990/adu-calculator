function YardScene() {
  return (
    <svg viewBox="0 0 640 460" className="h-auto w-full" aria-hidden="true">
      <rect width="640" height="460" rx="28" fill="#E7F0EA" />
      <path d="M0 318h640v142H0z" fill="#E4D3BC" />
      <path d="M0 300c80 28 140 10 220-8 90-20 150 8 230 6 70-2 130 18 190 22v18H0z" fill="#D7C3A6" />
      <circle cx="92" cy="250" r="46" fill="#2F5D4A" />
      <rect x="84" y="250" width="16" height="70" rx="4" fill="#6B4A32" />
      <path d="M150 292 268 196l118 96v112H150z" fill="#F7F1E8" stroke="#234237" strokeWidth="3" />
      <path d="M138 292 268 176l130 116" fill="none" stroke="#234237" strokeWidth="3" strokeLinejoin="round" />
      <path d="M168 292h28v64h-28zM250 230h36v32h-36zM312 230h36v32h-36z" fill="#F3E2D8" stroke="#234237" strokeWidth="3" />
      <path d="M430 250 520 184l90 66v130H430z" fill="#FFFCF8" stroke="#9A3412" strokeWidth="3" />
      <path d="M418 250 520 168l102 82" fill="none" stroke="#9A3412" strokeWidth="3" strokeLinejoin="round" />
      <path d="M492 292h28v48h-28zM548 214h26v22h-26z" fill="#F3E2D8" stroke="#9A3412" strokeWidth="3" />
      <path d="M250 360h150" stroke="#C4B29A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="560" cy="118" r="28" fill="#F0C9A0" />
    </svg>
  );
}

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1.1fr_0.9fr] md:py-20" aria-labelledby="hero-heading">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">Los Angeles ADU & remodel</p>
        <h1 id="hero-heading" className="mt-4 max-w-xl font-serif text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
          See what an ADU could earn and add to your home&apos;s value.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-ink-soft">
          Home First Remodel builds garage conversions, attached suites, and backyard cottages for Los Angeles
          homeowners. Price the project, the rent, and the equity before you call.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="#calculator"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-pine px-5 text-base font-semibold text-white hover:bg-[#1b332b]"
          >
            Run the calculator
          </a>
          <a
            href="#consultation"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-line bg-surface px-5 text-base font-semibold text-ink hover:border-pine"
          >
            Request a consultation
          </a>
        </div>
        <ul className="mt-8 flex flex-col gap-2 text-sm text-ink-soft sm:flex-row sm:flex-wrap sm:gap-x-6">
          <li>No account required</li>
          <li>Address lookup is optional</li>
          <li>Estimates, not a bid</li>
        </ul>
      </div>
      <YardScene />
    </section>
  );
}
